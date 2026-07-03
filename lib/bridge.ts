// Dataset is configurable via env so it matches whatever the MLS approved
// (defaults to the MIAMI dataset). Token is always a Railway env var.
// We use the RESO Web API (OData) endpoint, which uses standard $filter/$orderby
// syntax and returns { value: [...] }.
const BRIDGE_DATASET = process.env.BRIDGE_DATASET_ID || "miamire"
const BRIDGE_ODATA_BASE = `https://api.bridgedataoutput.com/api/v2/OData/${BRIDGE_DATASET}`
// The RESO OData Media resource withholds photo URLs for MIAMI (MediaURL null),
// but the Bridge Web API /listings endpoint returns real CDN photo URLs inline.
const BRIDGE_WEBAPI_BASE = `https://api.bridgedataoutput.com/api/v2/${BRIDGE_DATASET}`

// Extract ordered, de-duplicated photo URLs from a Web API listing object.
function photosFromListing(l: any): string[] {
  if (!l) return []
  const media = l.Media || l.Photos || l.photos
  if (Array.isArray(media)) {
    const urls = media
      .map((m: any) => (typeof m === "string" ? m : m?.MediaURL || m?.MediaUrl || m?.Url || m?.url))
      .filter((u: any) => typeof u === "string" && /^https?:\/\//.test(u))
    if (urls.length) return Array.from(new Set(urls))
  }
  // Fallback: pull image URLs straight out of the JSON (order preserved)
  const matches = JSON.stringify(l).match(/https?:\/\/[^"'\\ ]+\.(?:jpe?g|png|webp)(?:\?[^"'\\ ]*)?/gi) || []
  return Array.from(new Set(matches))
}

interface BridgeListing {
  ListingKey: string
  ListingId: string
  UnparsedAddress: string
  City: string
  StateOrProvince: string
  PostalCode: string
  ListPrice: number
  OriginalListPrice?: number
  BedroomsTotal?: number
  BathroomsTotalDecimal?: number
  LivingArea?: number
  LotSizeAcres?: number
  YearBuilt?: number
  PropertyType?: string
  PropertySubType?: string
  StandardStatus: string
  PublicRemarks?: string
  Media?: Array<{ MediaURL: string }>
  InteriorFeatures?: string[]
  GarageSpaces?: number
  PoolPrivateYN?: boolean
  AssociationFee?: number
  TaxAnnualAmount?: number
  OnMarketDate?: string
  ExpirationDate?: string
  DaysOnMarket?: number
  ListAgentFullName?: string
  ListAgentDirectPhone?: string
  ListAgentEmail?: string
  ListOfficeName?: string
  Latitude?: number
  Longitude?: number
}

function mapPropertyType(type?: string, subtype?: string): string {
  const t = (subtype || type || "").toLowerCase()
  if (t.includes("condo") || t.includes("condominium")) return "CONDO"
  if (t.includes("townhouse") || t.includes("townhome")) return "TOWNHOUSE"
  if (t.includes("multi") || t.includes("duplex")) return "MULTI_FAMILY"
  return "SINGLE_FAMILY"
}

export async function fetchListings(params: {
  city?: string
  zipCode?: string
  minPrice?: number
  maxPrice?: number
  minBeds?: number
  propertyType?: string
  limit?: number
  offset?: number
}): Promise<BridgeListing[]> {
  const token = process.env.BRIDGE_SERVER_TOKEN
  if (!token) throw new Error("BRIDGE_SERVER_TOKEN not set")

  // OData $filter (single quotes in string literals are escaped by doubling)
  const esc = (s: string) => s.replace(/'/g, "''")
  const filters: string[] = [`StandardStatus eq 'Active'`]
  if (params.minPrice) filters.push(`ListPrice ge ${params.minPrice}`)
  if (params.maxPrice) filters.push(`ListPrice le ${params.maxPrice}`)
  if (params.minBeds) filters.push(`BedroomsTotal ge ${params.minBeds}`)
  if (params.city) filters.push(`City eq '${esc(params.city)}'`)
  if (params.zipCode) filters.push(`PostalCode eq '${esc(params.zipCode)}'`)

  const query = new URLSearchParams()
  query.set("access_token", token)
  query.set("$top", String(params.limit || 20))
  query.set("$skip", String(params.offset || 0))
  query.set("$filter", filters.join(" and "))
  query.set("$orderby", "ModificationTimestamp desc")
  query.set("$expand", "Media") // pull listing photos inline (RESO nav property)

  const url = `${BRIDGE_ODATA_BASE}/Property?${query.toString()}`
  const res = await fetch(url, { next: { revalidate: 300 } }) // cache 5 min

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Bridge API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.value || []
}

// Photos: $expand=Media on Property returns media metadata but WITHHOLDS the
// URLs (MediaURL comes back null). The real URLs live on the Media resource,
// queried directly by the listing's ListingKey (= Media.ResourceRecordKey).
export async function fetchListingMediaRaw(listingKey: string): Promise<any[]> {
  const token = process.env.BRIDGE_SERVER_TOKEN
  if (!token || !listingKey) return []

  const query = new URLSearchParams()
  query.set("access_token", token)
  query.set("$filter", `ResourceRecordKey eq '${listingKey.replace(/'/g, "''")}'`)
  query.set("$orderby", "Order")
  query.set("$top", "50")

  try {
    const res = await fetch(`${BRIDGE_ODATA_BASE}/Media?${query.toString()}`, { next: { revalidate: 300 } })
    if (!res.ok) return []
    const data = await res.json()
    return data.value || []
  } catch {
    return []
  }
}

// All photo URLs for a single listing (detail page) — via the Bridge Web API,
// which returns real CDN URLs (the OData Media resource returns null MediaURL).
export async function fetchListingMedia(listingKey: string): Promise<string[]> {
  const token = process.env.BRIDGE_SERVER_TOKEN
  if (!token || !listingKey) return []
  try {
    const res = await fetch(
      `${BRIDGE_WEBAPI_BASE}/listings/${encodeURIComponent(listingKey)}?access_token=${token}`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return []
    const data = await res.json()
    const listing = Array.isArray(data.bundle) ? data.bundle[0] : data.bundle
    return photosFromListing(listing)
  } catch {
    return []
  }
}

// Build a display address, falling back to street components when UnparsedAddress
// is missing (some MLS records withhold it).
export function buildDisplayAddress(l: any): string {
  if (l?.UnparsedAddress && String(l.UnparsedAddress).trim()) return String(l.UnparsedAddress).trim()
  const street = [l?.StreetNumber, l?.StreetDirPrefix, l?.StreetName, l?.StreetSuffix, l?.StreetDirSuffix]
    .filter(Boolean).join(" ").trim()
  const unit = l?.UnitNumber ? ` # ${l.UnitNumber}` : ""
  const cityState = [l?.City, l?.StateOrProvince].filter(Boolean).join(", ")
  const parts = [street ? street + unit : "", cityState, l?.PostalCode].filter(s => s && String(s).trim())
  return parts.join(", ") || "Dirección disponible al contactar"
}

// IDX search — Active, for-sale Residential only (excludes rentals, commercial, land).
export async function searchIdxListings(params: {
  city?: string; zip?: string; minPrice?: number; maxPrice?: number
  minBeds?: number; maxBeds?: number; minBaths?: number; maxBaths?: number
  minGarage?: number; propertySubType?: string; mode?: "sale" | "rent"
  minSqft?: number; maxSqft?: number; minYear?: number; maxYear?: number
  maxHoa?: number; maxDom?: number; pool?: boolean; waterfront?: boolean
  sort?: string; limit?: number; offset?: number
}): Promise<any[]> {
  const token = process.env.BRIDGE_SERVER_TOKEN
  if (!token) throw new Error("BRIDGE_SERVER_TOKEN not set")
  const esc = (s: string) => s.replace(/'/g, "''")

  // "rent" → Residential Lease; "sale" (default) → Residential (for-sale).
  const resoType = params.mode === "rent" ? "Residential Lease" : "Residential"

  // InternetEntireListingDisplayYN gates IDX display: listings whose agent/seller
  // opted out must NOT be shown (compliance) — and those are exactly the ones whose
  // photo URLs come back null. Filtering to true fixes both.
  const filters = [
    `StandardStatus eq 'Active'`,
    `PropertyType eq '${resoType}'`,
    `InternetEntireListingDisplayYN eq true`,
  ]
  if (params.minPrice) filters.push(`ListPrice ge ${params.minPrice}`)
  if (params.maxPrice) filters.push(`ListPrice le ${params.maxPrice}`)
  if (params.minBeds) filters.push(`BedroomsTotal ge ${params.minBeds}`)
  if (params.maxBeds) filters.push(`BedroomsTotal le ${params.maxBeds}`)
  if (params.minBaths) filters.push(`BathroomsTotalDecimal ge ${params.minBaths}`)
  if (params.maxBaths) filters.push(`BathroomsTotalDecimal le ${params.maxBaths}`)
  if (params.minGarage) filters.push(`GarageSpaces ge ${params.minGarage}`)
  if (params.minSqft) filters.push(`LivingArea ge ${params.minSqft}`)
  if (params.maxSqft) filters.push(`LivingArea le ${params.maxSqft}`)
  if (params.minYear) filters.push(`YearBuilt ge ${params.minYear}`)
  if (params.maxYear) filters.push(`YearBuilt le ${params.maxYear}`)
  if (params.maxHoa) filters.push(`AssociationFee le ${params.maxHoa}`)
  if (params.maxDom) filters.push(`DaysOnMarket le ${params.maxDom}`)
  if (params.pool) filters.push(`PoolPrivateYN eq true`)
  if (params.waterfront) filters.push(`WaterfrontYN eq true`)
  if (params.zip) filters.push(`PostalCode eq '${esc(params.zip.trim())}'`)
  if (params.city) {
    // MLS stores city Title-cased (e.g. "Miami", "Fort Lauderdale") and OData
    // eq is case-sensitive — normalize the user's input so "miami" matches.
    const titleCity = params.city.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
    filters.push(`City eq '${esc(titleCity)}'`)
  }
  if (params.propertySubType) filters.push(`PropertySubType eq '${esc(params.propertySubType)}'`)

  const query = new URLSearchParams()
  query.set("access_token", token)
  query.set("$top", String(params.limit || 24))
  query.set("$skip", String(params.offset || 0))
  query.set("$filter", filters.join(" and "))
  const orderBy = params.sort === "price_asc" ? "ListPrice asc"
    : params.sort === "price_desc" ? "ListPrice desc"
    : "ModificationTimestamp desc"
  query.set("$orderby", orderBy)
  query.set("$count", "true")

  const res = await fetch(`${BRIDGE_ODATA_BASE}/Property?${query.toString()}`, { next: { revalidate: 300 } })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Bridge search error ${res.status}: ${err}`)
  }
  const data = await res.json()
  const listings = data.value || []
  ;(listings as any).__total = data["@odata.count"] ?? listings.length
  return listings
}

// Total count of matching listings (for numbered pagination).
export function idxTotalFromResult(listings: any[]): number {
  return (listings as any).__total ?? listings.length
}

// Area market stats from the whole MLS (not just our listings) — for the homepage
// Market Snapshot. $count gives the true active total; averages from a sample.
export async function fetchAreaStats(city = "Miami"): Promise<{ activeListings: number; avgPrice: number | null; avgDaysOnMarket: number | null }> {
  const token = process.env.BRIDGE_SERVER_TOKEN
  if (!token) return { activeListings: 0, avgPrice: null, avgDaysOnMarket: null }
  const titleCity = city.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
  const q = new URLSearchParams()
  q.set("access_token", token)
  q.set("$filter", [
    `StandardStatus eq 'Active'`,
    `PropertyType eq 'Residential'`,
    `InternetEntireListingDisplayYN eq true`,
    `City eq '${titleCity.replace(/'/g, "''")}'`,
  ].join(" and "))
  q.set("$select", "ListPrice,DaysOnMarket")
  q.set("$top", "200")
  q.set("$count", "true")
  try {
    const res = await fetch(`${BRIDGE_ODATA_BASE}/Property?${q.toString()}`, { next: { revalidate: 3600 } })
    if (!res.ok) return { activeListings: 0, avgPrice: null, avgDaysOnMarket: null }
    const data = await res.json()
    const rows: any[] = data.value || []
    const count = data["@odata.count"] ?? rows.length
    const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((s, x) => s + x, 0) / arr.length) : null)
    const prices = rows.map(r => r.ListPrice).filter((x: any) => typeof x === "number" && x > 0)
    const doms = rows.map(r => r.DaysOnMarket).filter((x: any) => typeof x === "number" && x >= 0)
    return { activeListings: count, avgPrice: avg(prices), avgDaysOnMarket: avg(doms) }
  } catch {
    return { activeListings: 0, avgPrice: null, avgDaysOnMarket: null }
  }
}

// Single listing by ListingKey (detail page).
export async function fetchListingByKey(listingKey: string): Promise<any | null> {
  const token = process.env.BRIDGE_SERVER_TOKEN
  if (!token || !listingKey) return null
  const query = new URLSearchParams()
  query.set("access_token", token)
  query.set("$filter", `ListingKey eq '${listingKey.replace(/'/g, "''")}'`)
  query.set("$top", "1")
  try {
    const res = await fetch(`${BRIDGE_ODATA_BASE}/Property?${query.toString()}`, { next: { revalidate: 300 } })
    if (!res.ok) return null
    const data = await res.json()
    return (data.value && data.value[0]) || null
  } catch {
    return null
  }
}

// First photo per listing for search thumbnails. ONE batched Web API /listings
// query for all keys (photos are returned inline with real CDN URLs).
export async function fetchPrimaryPhotos(listingKeys: string[]): Promise<Record<string, string>> {
  const token = process.env.BRIDGE_SERVER_TOKEN
  if (!token || listingKeys.length === 0) return {}
  const query = new URLSearchParams()
  query.set("access_token", token)
  query.set("ListingKey.in", listingKeys.join(","))
  query.set("limit", String(listingKeys.length))
  try {
    const res = await fetch(`${BRIDGE_WEBAPI_BASE}/listings?${query.toString()}`, { next: { revalidate: 300 } })
    if (!res.ok) return {}
    const data = await res.json()
    const bundle: any[] = Array.isArray(data.bundle) ? data.bundle : []
    const map: Record<string, string> = {}
    for (const l of bundle) {
      const photos = photosFromListing(l)
      if (l.ListingKey && photos[0]) map[l.ListingKey] = photos[0]
    }
    return map
  } catch {
    return {}
  }
}

export function bridgeToProperty(l: BridgeListing) {
  return {
    mlsId: l.ListingKey || l.ListingId,
    address: l.UnparsedAddress || "",
    city: l.City || "Miami",
    state: l.StateOrProvince || "FL",
    zip: l.PostalCode || "",
    price: l.ListPrice || 0,
    originalPrice: l.OriginalListPrice || undefined,
    bedrooms: l.BedroomsTotal || undefined,
    bathrooms: l.BathroomsTotalDecimal || undefined,
    sqft: l.LivingArea ? Math.round(l.LivingArea) : undefined,
    lotSize: l.LotSizeAcres || undefined,
    yearBuilt: l.YearBuilt || undefined,
    propertyType: mapPropertyType(l.PropertyType, l.PropertySubType),
    status: "ACTIVE",
    description: l.PublicRemarks || undefined,
    images: l.Media?.length ? JSON.stringify(l.Media.slice(0, 20).map(m => m.MediaURL)) : undefined,
    garage: l.GarageSpaces ? Math.round(l.GarageSpaces) : undefined,
    pool: !!l.PoolPrivateYN,
    hoa: l.AssociationFee || undefined,
    taxes: l.TaxAnnualAmount || undefined,
    listingDate: l.OnMarketDate ? new Date(l.OnMarketDate) : undefined,
    daysOnMarket: l.DaysOnMarket || undefined,
    agentName: l.ListAgentFullName || undefined,
    agentPhone: l.ListAgentDirectPhone || undefined,
    agentEmail: l.ListAgentEmail || undefined,
    office: l.ListOfficeName || undefined,
    latitude: l.Latitude || undefined,
    longitude: l.Longitude || undefined,
  }
}
