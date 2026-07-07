export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { searchIdxListings, fetchPrimaryPhotos, buildDisplayAddress, idxTotalFromResult } from "@/lib/bridge"

// CORS: allow partner apps (e.g. Easy Rental) to consume this endpoint from the browser
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

// Public IDX search — Active, for-sale Residential listings from the MLS feed.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const num = (k: string) => {
    const v = searchParams.get(k)
    return v && !isNaN(Number(v)) ? Number(v) : undefined
  }

  try {
    // The location box accepts any mix of cities and 5-digit ZIPs, comma-separated:
    // "Miami", "33032", "33032, 33034, 33035", "Homestead, 33032" all work.
    const loc = (searchParams.get("city") || "").trim()
    const locTokens = loc ? loc.split(",").map(s => s.trim()).filter(Boolean) : []
    const zipTokens = locTokens.filter(t => /^\d{5}$/.test(t))
    const cityTokens = locTokens.filter(t => !/^\d{5}$/.test(t))
    const zipParam = (searchParams.get("zip") || "").trim()
    if (/^\d{5}$/.test(zipParam)) zipTokens.push(zipParam)

    const bool = (k: string) => searchParams.get(k) === "1" || searchParams.get(k) === "true"

    const pageSize = Math.min(num("limit") || 24, 48)
    const offset = num("offset") || 0

    const keyword = searchParams.get("keyword")?.trim() || undefined
    // When keyword is set, skip city/zip — they'd AND together and block MLS# / address results
    const listings = await searchIdxListings({
      cities: (!keyword && cityTokens.length > 0) ? cityTokens : undefined,
      zips: (!keyword && zipTokens.length > 0) ? zipTokens : undefined,
      minPrice: num("minPrice"),
      maxPrice: num("maxPrice"),
      minBeds: num("minBeds"),
      maxBeds: num("maxBeds"),
      minBaths: num("minBaths"),
      maxBaths: num("maxBaths"),
      minGarage: num("minGarage"),
      propertySubTypes: searchParams.get("type")
        ? searchParams.get("type")!.split(",").map(s => s.trim()).filter(Boolean)
        : undefined,
      mode: searchParams.get("mode") === "rent" ? "rent" : "sale",
      minSqft: num("minSqft"),
      maxSqft: num("maxSqft"),
      minYear: num("minYear"),
      maxYear: num("maxYear"),
      maxHoa: num("maxHoa"),
      maxDom: num("maxDom"),
      pool: bool("pool"),
      waterfront: bool("waterfront"),
      sort: searchParams.get("sort") || undefined,
      limit: pageSize,
      offset,
      keyword,
    })
    const total = idxTotalFromResult(listings)
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const page = Math.floor(offset / pageSize) + 1
    const hasMore = page < totalPages

    const keys = listings.map((l: any) => l.ListingKey).filter(Boolean)
    const photos = await fetchPrimaryPhotos(keys)

    const results = listings.map((l: any) => ({
      listingKey: l.ListingKey,
      listingId: l.ListingId ?? l.ListingKey ?? "", // real MLS# (e.g. A11234567)
      address: buildDisplayAddress(l),
      city: l.City ?? null,
      state: l.StateOrProvince ?? null,
      zip: l.PostalCode ?? null,
      price: l.ListPrice ?? null,
      beds: l.BedroomsTotal ?? null,
      baths: l.BathroomsTotalDecimal ?? null,
      sqft: l.LivingArea ?? null,
      yearBuilt: l.YearBuilt ?? null,
      subType: l.PropertySubType ?? null,
      description: l.PublicRemarks ? String(l.PublicRemarks).slice(0, 300) : null,
      photo: photos[l.ListingKey] || null,
      office: l.ListOfficeName || null,
    }))

    return NextResponse.json({ ok: true, count: results.length, total, totalPages, page, hasMore, results }, { headers: CORS_HEADERS })
  } catch (e: any) {
    const msg = String(e?.message || "Search failed")
    // Distinguish a configuration/connection problem (token missing or rejected
    // by Bridge) from a normal "no results" so the UI can show the real cause.
    const isAuth = /BRIDGE_SERVER_TOKEN|401|403|unauthor/i.test(msg)
    console.error("[idx/search] error:", msg)
    return NextResponse.json({
      ok: false,
      error: isAuth
        ? "MLS/IDX connection error — the Bridge API token is missing or rejected. Check BRIDGE_SERVER_TOKEN in Railway."
        : msg,
      code: isAuth ? "IDX_DISCONNECTED" : "SEARCH_ERROR",
    }, { status: isAuth ? 503 : 500, headers: CORS_HEADERS })
  }
}
