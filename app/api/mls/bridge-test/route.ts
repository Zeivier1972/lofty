export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { searchIdxListings, fetchListingMedia, buildDisplayAddress } from "@/lib/bridge"

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
    const report = await Promise.all(
      listings.map(async (l: any) => {
        const photos = await fetchListingMedia(l.ListingKey)
        return {
          address: buildDisplayAddress(l),
          city: l.City,
          display: l.InternetEntireListingDisplayYN,
          photosCountField: l.PhotosCount ?? null,
          photoUrlsResolved: photos.length,
          firstPhoto: photos[0] || null,
        }
      })
    )
    return NextResponse.json({
      ok: true,
      city: city || "(sin filtro)",
      returned: listings.length,
      withPhotos: report.filter(r => r.photoUrlsResolved > 0).length,
      report,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || "diagnostic failed" }, { status: 500 })
  }
}
