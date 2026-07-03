export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { searchIdxListings, fetchListingMediaRaw } from "@/lib/bridge"

// Dump the full raw Media rows for the first listing of a city, so we can find
// where the photo URL lives (or why it's null) for listings that show no photos.
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
    const listings = await searchIdxListings({ city, limit: 5 })
    const first: any = listings[0]
    const key = first?.ListingKey
    const rawMedia = key ? await fetchListingMediaRaw(key) : []
    return NextResponse.json({
      ok: true,
      city: city || "(sin filtro)",
      returned: listings.length,
      inspectedListing: {
        key,
        address: first?.UnparsedAddress ?? null,
        photosCount: first?.PhotosCount ?? null,
        display: first?.InternetEntireListingDisplayYN ?? null,
        okToAdvertise: first?.MIAMIRE_OkToAdvertiseList ?? null,
      },
      rawMediaCount: rawMedia.length,
      rawMediaRows: rawMedia.slice(0, 3),
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || "diagnostic failed" }, { status: 500 })
  }
}
