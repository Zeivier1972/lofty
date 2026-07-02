// Dataset is configurable via env so it matches whatever the MLS approved
// (defaults to the MIAMI dataset). Token is always a Railway env var.
// We use the RESO Web API (OData) endpoint, which uses standard $filter/$orderby
// syntax and returns { value: [...] }.
const BRIDGE_DATASET = process.env.BRIDGE_DATASET_ID || "miamire"
const BRIDGE_ODATA_BASE = `https://api.bridgedataoutput.com/api/v2/OData/${BRIDGE_DATASET}`

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

export async function fetchListingMedia(listingKey: string): Promise<string[]> {
  const media = await fetchListingMediaRaw(listingKey)
  return media
    .map(m => m.MediaURL || m.ResizeMediaURL)
    .filter((u): u is string => typeof u === "string" && u.length > 0)
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
  city?: string; minPrice?: number; maxPrice?: number; minBeds?: number
  minBaths?: number; minGarage?: number; propertySubType?: string
  limit?: number; offset?: number
}): Promise<any[]> {
  const token = process.env.BRIDGE_SERVER_TOKEN
  if (!token) throw new Error("BRIDGE_SERVER_TOKEN not set")
  const esc = (s: string) => s.replace(/'/g, "''")

  const filters = [`StandardStatus eq 'Active'`, `PropertyType eq 'Residential'`]
  if (params.minPrice) filters.push(`ListPrice ge ${params.minPrice}`)
  if (params.maxPrice) filters.push(`ListPrice le ${params.maxPrice}`)
  if (params.minBeds) filters.push(`BedroomsTotal ge ${params.minBeds}`)
  if (params.minBaths) filters.push(`BathroomsTotalDecimal ge ${params.minBaths}`)
  if (params.minGarage) filters.push(`GarageSpaces ge ${params.minGarage}`)
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
  query.set("$orderby", "ModificationTimestamp desc")

  const res = await fetch(`${BRIDGE_ODATA_BASE}/Property?${query.toString()}`, { next: { revalidate: 300 } })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Bridge search error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.value || []
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

// First available photo for many listings in ONE query — for search thumbnails.
// Ordered by Order asc, we take the first row per listing that actually has a URL
// (Order isn't always 0-based and some rows have null URLs).
export async function fetchPrimaryPhotos(listingKeys: string[]): Promise<Record<string, string>> {
  const token = process.env.BRIDGE_SERVER_TOKEN
  if (!token || listingKeys.length === 0) return {}
  const keyList = listingKeys.map(k => `'${k.replace(/'/g, "''")}'`).join(",")
  const query = new URLSearchParams()
  query.set("access_token", token)
  query.set("$filter", `ResourceRecordKey in (${keyList}) and MediaType eq 'Image'`)
  query.set("$orderby", "Order")
  query.set("$top", "1000")
  try {
    const res = await fetch(`${BRIDGE_ODATA_BASE}/Media?${query.toString()}`, { next: { revalidate: 300 } })
    if (!res.ok) return {}
    const data = await res.json()
    const map: Record<string, string> = {}
    for (const m of (data.value || [])) {
      const url = m.MediaURL || m.ResizeMediaURL
      if (m.ResourceRecordKey && url && !map[m.ResourceRecordKey]) map[m.ResourceRecordKey] = url
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
