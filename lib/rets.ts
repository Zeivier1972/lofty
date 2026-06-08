import * as rets from "rets-client"

export interface IDXConfig {
  provider: string
  loginUrl: string
  username: string
  password: string
  mlsId?: string
}

// Field mappings for Miami MLS (MIAMI MLS RETS)
// Left = our Property model field, Right = RETS field name(s) to try in order
const FIELD_MAP: Record<string, string[]> = {
  mlsId:        ["L_ListingID", "MLS_NUM", "ListingId", "MLS#", "Matrix_Unique_ID"],
  address:      ["L_Address_1", "StreetAddress", "PropertyAddress", "L_DisplayAddress"],
  city:         ["L_City_Name", "City", "L_City"],
  state:        ["L_State_ID", "StateOrProvince", "State"],
  zip:          ["L_Zip_Code", "PostalCode", "ZipCode"],
  price:        ["L_AskingPrice_1", "ListPrice", "L_LastAskingPrice", "CurrentPrice"],
  bedrooms:     ["LFD_Bedrooms_4", "BedroomsTotal", "Bedrooms", "L_Bedrooms"],
  bathrooms:    ["LFD_Bath_1", "BathroomsTotalInteger", "Bathrooms", "L_Bathrooms"],
  sqft:         ["L_Sq_Ft_1", "LivingArea", "SquareFeet", "SqFt"],
  yearBuilt:    ["L_YrBlt", "YearBuilt", "Year_Built"],
  description:  ["L_PublicRemarks", "PublicRemarks", "Remarks"],
  status:       ["L_Status", "StandardStatus", "MlsStatus"],
  propertyType: ["LFD_PropertySubType_44", "PropertySubType", "PropertyType", "LFD_PropertyType_5"],
  daysOnMarket: ["L_DOM", "DaysOnMarket", "DOM"],
  latitude:     ["L_Latitude", "Latitude"],
  longitude:    ["L_Longitude", "Longitude"],
  agentName:    ["L_ListAgent_FullName", "ListAgentFullName", "ListAgentName"],
  agentEmail:   ["L_ListAgent_Email", "ListAgentEmail"],
  agentPhone:   ["L_ListAgent_Phone", "ListAgentDirectPhone"],
  office:       ["L_CompanyName", "ListOfficeName"],
  listingDate:  ["L_ListingDate", "ListingContractDate", "L_InputDate"],
  hoa:          ["LFD_HOA_YN_57", "AssociationFee", "HOAFee"],
  pool:         ["LFD_Pool_52", "PoolPrivateYN", "Pool"],
}

function pick(row: Record<string, any>, candidates: string[]): any {
  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== "" && row[key] !== null) return row[key]
  }
  return null
}

function mapStatus(retsStatus: string): string {
  const s = (retsStatus || "").toUpperCase()
  if (s === "A" || s === "ACTIVE") return "ACTIVE"
  if (s === "P" || s === "PENDING" || s === "UAG" || s === "CONTINGENT") return "PENDING"
  if (s === "S" || s === "SOLD" || s === "CL" || s === "CLOSED") return "SOLD"
  if (s === "E" || s === "EXPIRED") return "EXPIRED"
  return "ACTIVE"
}

function mapPropertyType(retsType: string): string {
  const t = (retsType || "").toLowerCase()
  if (t.includes("condo") || t.includes("co-op")) return "CONDO"
  if (t.includes("townhouse") || t.includes("townhome")) return "TOWNHOUSE"
  if (t.includes("multi") || t.includes("duplex")) return "MULTI_FAMILY"
  if (t.includes("land") || t.includes("lot")) return "LAND"
  if (t.includes("commercial")) return "COMMERCIAL"
  return "SINGLE_FAMILY"
}

export async function testRETSConnection(config: IDXConfig): Promise<{ success: boolean; message: string }> {
  try {
    const client = await rets.getAutoLogoutClient({
      loginUrl: config.loginUrl,
      username: config.username,
      password: config.password,
      version: "auto",
      userAgent: "LoftyCRM/1.0",
      userAgentPassword: "",
    }, async (client: any) => {
      const systemData = await client.metadata.getSystem()
      return { systemId: systemData?.systemId || "connected" }
    })
    return { success: true, message: `Connected successfully` }
  } catch (e: any) {
    const msg = e?.message || String(e)
    if (msg.includes("401") || msg.includes("Unauthorized")) {
      return { success: false, message: "Invalid username or password" }
    }
    if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) {
      return { success: false, message: "Cannot reach MLS server — check the login URL" }
    }
    return { success: false, message: `Connection failed: ${msg.slice(0, 100)}` }
  }
}

export interface SyncResult {
  imported: number
  updated: number
  skipped: number
  errors: string[]
  fields?: string[] // discovered field names for debugging
}

export async function syncMLSListings(
  config: IDXConfig,
  prisma: any,
  options: { limit?: number; statusFilter?: string } = {}
): Promise<SyncResult> {
  const result: SyncResult = { imported: 0, updated: 0, skipped: 0, errors: [] }
  const limit = options.limit || 200
  const statusFilter = options.statusFilter || "A"  // A = Active

  try {
    await rets.getAutoLogoutClient({
      loginUrl: config.loginUrl,
      username: config.username,
      password: config.password,
      version: "auto",
      userAgent: "LoftyCRM/1.0",
      userAgentPassword: "",
    }, async (client: any) => {
      // Discover resources and classes
      let resource = "Property"
      let className = "RE_1"

      try {
        const resources = await client.metadata.getResources()
        const propResource = resources?.Resources?.Resource?.find(
          (r: any) => r.ResourceID === "Property" || r.ResourceID === "Listing"
        )
        if (propResource) resource = propResource.ResourceID

        const classes = await client.metadata.getClass(resource)
        const resClass = classes?.Classes?.Class?.find(
          (c: any) => c.ClassName === "RE_1" || c.ClassName === "ResidentialProperty" || c.ClassName === "Residential"
        )
        if (resClass) className = resClass.ClassName
      } catch {
        // Use defaults
      }

      // Get field metadata for mapping
      let discoveredFields: string[] = []
      try {
        const meta = await client.metadata.getTable(resource, className)
        discoveredFields = (meta?.Fields?.Field || []).map((f: any) => f.SystemName).slice(0, 50)
        result.fields = discoveredFields
      } catch {
        // Continue without metadata
      }

      // Search for active listings
      const query = statusFilter === "all"
        ? "(L_Status=|A,P)"
        : `(L_Status=${statusFilter})`

      const searchResult = await client.search.query(resource, className, query, {
        limit,
        offset: 0,
        format: "COMPACT-DECODED",
        count: 1,
      })

      const rows: Record<string, any>[] = searchResult?.results || []

      for (const row of rows) {
        try {
          const mlsId = pick(row, FIELD_MAP.mlsId)
          const address = pick(row, FIELD_MAP.address)
          const city = pick(row, FIELD_MAP.city) || ""
          const state = pick(row, FIELD_MAP.state) || "FL"
          const zip = pick(row, FIELD_MAP.zip) || ""
          const priceRaw = pick(row, FIELD_MAP.price)
          const price = priceRaw ? parseFloat(String(priceRaw).replace(/[^0-9.]/g, "")) : 0

          if (!address || !price) { result.skipped++; continue }

          const bedsRaw = pick(row, FIELD_MAP.bedrooms)
          const bathsRaw = pick(row, FIELD_MAP.bathrooms)
          const sqftRaw = pick(row, FIELD_MAP.sqft)
          const yearRaw = pick(row, FIELD_MAP.yearBuilt)
          const statusRaw = pick(row, FIELD_MAP.status)
          const typeRaw = pick(row, FIELD_MAP.propertyType)
          const domRaw = pick(row, FIELD_MAP.daysOnMarket)
          const latRaw = pick(row, FIELD_MAP.latitude)
          const lngRaw = pick(row, FIELD_MAP.longitude)
          const hoaRaw = pick(row, FIELD_MAP.hoa)
          const poolRaw = pick(row, FIELD_MAP.pool)

          const data = {
            mlsId: mlsId || undefined,
            address,
            city,
            state,
            zip,
            price,
            bedrooms: bedsRaw ? parseInt(bedsRaw) : null,
            bathrooms: bathsRaw ? parseFloat(bathsRaw) : null,
            sqft: sqftRaw ? parseInt(sqftRaw) : null,
            yearBuilt: yearRaw ? parseInt(yearRaw) : null,
            status: mapStatus(statusRaw || "A"),
            propertyType: mapPropertyType(typeRaw || ""),
            description: pick(row, FIELD_MAP.description) || null,
            daysOnMarket: domRaw ? parseInt(domRaw) : null,
            latitude: latRaw ? parseFloat(latRaw) : null,
            longitude: lngRaw ? parseFloat(lngRaw) : null,
            agentName: pick(row, FIELD_MAP.agentName) || null,
            agentEmail: pick(row, FIELD_MAP.agentEmail) || null,
            agentPhone: pick(row, FIELD_MAP.agentPhone) || null,
            office: pick(row, FIELD_MAP.office) || null,
            hoa: hoaRaw ? parseFloat(String(hoaRaw).replace(/[^0-9.]/g, "")) : null,
            pool: poolRaw ? String(poolRaw).toUpperCase() === "Y" || String(poolRaw) === "1" || String(poolRaw).toLowerCase() === "yes" : false,
          }

          if (mlsId) {
            const existing = await prisma.property.findFirst({ where: { mlsId } })
            if (existing) {
              await prisma.property.update({ where: { id: existing.id }, data })
              result.updated++
            } else {
              await prisma.property.create({ data })
              result.imported++
            }
          } else {
            // No MLS ID — dedupe by address
            const existing = await prisma.property.findFirst({ where: { address, city } })
            if (existing) {
              await prisma.property.update({ where: { id: existing.id }, data })
              result.updated++
            } else {
              await prisma.property.create({ data })
              result.imported++
            }
          }
        } catch (rowErr: any) {
          result.errors.push(rowErr.message?.slice(0, 80) || "Row error")
        }
      }
    })
  } catch (e: any) {
    result.errors.push(`Sync failed: ${e.message?.slice(0, 100) || String(e)}`)
  }

  return result
}
