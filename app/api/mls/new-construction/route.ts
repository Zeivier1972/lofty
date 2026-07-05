export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { searchIdxListings, buildDisplayAddress } from "@/lib/bridge"

const MIAMI_METRO_CITIES = [
  "Miami", "Miami Beach", "Doral", "Coral Gables", "Aventura",
  "Sunny Isles Beach", "Hialeah", "Homestead", "Kendall", "Pinecrest",
  "South Miami", "North Miami", "North Miami Beach", "Brickell",
  "Edgewater", "Wynwood", "Little Havana", "Sweetwater",
]

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const city = url.searchParams.get("city") || undefined
  const minYear = parseInt(url.searchParams.get("minYear") || "2025") || 2025
  const minPrice = parseInt(url.searchParams.get("minPrice") || "0") || undefined
  const maxPrice = parseInt(url.searchParams.get("maxPrice") || "0") || undefined
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "48"), 100)

  try {
    const listings = await searchIdxListings({
      cities: city ? [city] : MIAMI_METRO_CITIES,
      minYear,
      minPrice,
      maxPrice,
      limit,
      sort: "price_asc",
    })

    const results = listings.map((l: any) => ({
      mlsId: l.ListingKey || l.ListingId || "",
      address: buildDisplayAddress(l),
      city: l.City || "",
      state: l.StateOrProvince || "FL",
      zip: l.PostalCode || "",
      price: l.ListPrice || 0,
      bedrooms: l.BedroomsTotal ?? null,
      bathrooms: l.BathroomsTotalDecimal ?? null,
      sqft: l.LivingArea ?? null,
      yearBuilt: l.YearBuilt ?? null,
      propertySubType: l.PropertySubType || "",
      description: l.PublicRemarks || "",
      agentName: l.ListAgentFullName || "",
      office: l.ListOfficeName || "",
      daysOnMarket: l.DaysOnMarket ?? null,
      image: l.Media?.[0]?.MediaURL || null,
    }))

    return NextResponse.json({
      results,
      total: (listings as any).__total ?? results.length,
      minYear,
    })
  } catch (e: any) {
    console.error("[mls/new-construction]", e)
    return NextResponse.json({ error: e.message, results: [] }, { status: 500 })
  }
}
