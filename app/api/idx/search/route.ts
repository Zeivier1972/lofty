export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { searchIdxListings, fetchPrimaryPhotos, buildDisplayAddress, idxTotalFromResult } from "@/lib/bridge"

// Public IDX search — Active, for-sale Residential listings from the MLS feed.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const num = (k: string) => {
    const v = searchParams.get(k)
    return v && !isNaN(Number(v)) ? Number(v) : undefined
  }

  try {
    // The location box accepts a city, comma-separated cities, or a 5-digit ZIP.
    const loc = (searchParams.get("city") || "").trim()
    const isZip = /^\d{5}$/.test(loc)

    // Support comma-separated multi-city values (e.g. from old email alert links)
    const cityTokens = loc && !isZip
      ? loc.split(",").map(s => s.trim()).filter(Boolean)
      : []

    const bool = (k: string) => searchParams.get(k) === "1" || searchParams.get(k) === "true"

    const pageSize = Math.min(num("limit") || 24, 48)
    const offset = num("offset") || 0

    const listings = await searchIdxListings({
      cities: cityTokens.length > 0 ? cityTokens : undefined,
      zip: isZip ? loc : (searchParams.get("zip") || undefined),
      minPrice: num("minPrice"),
      maxPrice: num("maxPrice"),
      minBeds: num("minBeds"),
      maxBeds: num("maxBeds"),
      minBaths: num("minBaths"),
      maxBaths: num("maxBaths"),
      minGarage: num("minGarage"),
      propertySubType: searchParams.get("type") || undefined,
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
    })
    const total = idxTotalFromResult(listings)
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const page = Math.floor(offset / pageSize) + 1
    const hasMore = page < totalPages

    const keys = listings.map((l: any) => l.ListingKey).filter(Boolean)
    const photos = await fetchPrimaryPhotos(keys)

    const results = listings.map((l: any) => ({
      listingKey: l.ListingKey,
      address: buildDisplayAddress(l),
      city: l.City ?? null,
      state: l.StateOrProvince ?? null,
      zip: l.PostalCode ?? null,
      price: l.ListPrice ?? null,
      beds: l.BedroomsTotal ?? null,
      baths: l.BathroomsTotalDecimal ?? null,
      sqft: l.LivingArea ?? null,
      subType: l.PropertySubType ?? null,
      photo: photos[l.ListingKey] || null,
      office: l.ListOfficeName || null,
    }))

    return NextResponse.json({ ok: true, count: results.length, total, totalPages, page, hasMore, results })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || "Search failed" }, { status: 500 })
  }
}
