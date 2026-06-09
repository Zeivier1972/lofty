const BRIDGE_BASE = "https://api.bridgedataoutput.com/api/v2/miamire"

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

  const query = new URLSearchParams()
  query.set("access_token", token)
  query.set("limit", String(params.limit || 20))
  query.set("offset", String(params.offset || 0))
  query.set("fields", [
    "ListingKey", "ListingId", "UnparsedAddress", "City", "StateOrProvince",
    "PostalCode", "ListPrice", "OriginalListPrice", "BedroomsTotal",
    "BathroomsTotalDecimal", "LivingArea", "LotSizeAcres", "YearBuilt",
    "PropertyType", "PropertySubType", "StandardStatus", "PublicRemarks",
    "Media", "GarageSpaces", "PoolPrivateYN", "AssociationFee",
    "TaxAnnualAmount", "OnMarketDate", "DaysOnMarket",
    "ListAgentFullName", "ListAgentDirectPhone", "ListAgentEmail",
    "ListOfficeName", "Latitude", "Longitude"
  ].join(","))

  // Build filter
  const filters: string[] = [`StandardStatus eq 'Active'`]
  if (params.minPrice) filters.push(`ListPrice ge ${params.minPrice}`)
  if (params.maxPrice) filters.push(`ListPrice le ${params.maxPrice}`)
  if (params.minBeds) filters.push(`BedroomsTotal ge ${params.minBeds}`)
  if (params.city) filters.push(`City eq '${params.city}'`)
  if (params.zipCode) filters.push(`PostalCode eq '${params.zipCode}'`)

  query.set("$filter", filters.join(" and "))
  query.set("$orderby", "OnMarketDate desc")

  const url = `${BRIDGE_BASE}/listings?${query.toString()}`
  const res = await fetch(url, { next: { revalidate: 300 } }) // cache 5 min

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Bridge API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.bundle || []
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
