export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { searchIdxListings, fetchPrimaryPhotos, buildDisplayAddress } from "@/lib/bridge"

// Per-city photo diagnostic: for each listing returned by the real IDX search,
// report whether it permits display and whether its photos actually resolve.
// Usage: /api/mls/bridge-test?city=Doral
export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!process.env.BRIDGE_SERVER_TOKEN) {
    return NextResponse.json({ ok: false, error: "BRIDGE_SERVER_TOKEN no configurado en Railway" }, { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const city = searchParams.get("city") || undefined

  try {
    const listings = await searchIdxListings({ city, limit: 10 })
    // Batched single query (same path /homes uses) — should return photos for
    // most listings without rate-limiting.
    const keys = listings.map((l: any) => l.ListingKey).filter(Boolean)
    const photos = await fetchPrimaryPhotos(keys)
    const report = listings.map((l: any) => ({
      address: buildDisplayAddress(l),
      city: l.City,
      photosCountField: l.PhotosCount ?? null,
      thumbnail: photos[l.ListingKey] || null,
    }))
    return NextResponse.json({
      ok: true,
      city: city || "(sin filtro)",
      returned: listings.length,
      batchedPhotosResolved: Object.keys(photos).length,
      report,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || "diagnostic failed" }, { status: 500 })
  }
}
