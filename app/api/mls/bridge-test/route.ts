export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { fetchListings, fetchListingMediaRaw, searchIdxListings } from "@/lib/bridge"

// Connectivity check for the Bridge RESO Web API feed.
// Confirms the token + dataset work and returns a few real listings so we can
// inspect the actual field/photo shape before building the native IDX pages.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.BRIDGE_SERVER_TOKEN) {
    return NextResponse.json(
      { ok: false, error: "BRIDGE_SERVER_TOKEN no está configurado en Railway" },
      { status: 400 }
    )
  }

  try {
    const listings = await fetchListings({ limit: 3 })
    // Pick the listing with the MOST expanded media items (that's the one that has photos).
    const withPhotos: any = [...listings].sort(
      (a, b) => ((b.Media as any[])?.length ?? 0) - ((a.Media as any[])?.length ?? 0)
    )[0]
    const key = withPhotos ? (withPhotos.ListingKey || withPhotos.ListingId) : null
    const rawMedia = key ? await fetchListingMediaRaw(key) : []
    const urls = rawMedia
      .map((m: any) => m.MediaURL || m.ResizeMediaURL)
      .filter((u: any) => typeof u === "string" && u.length > 0)
    // Discover the real PropertySubType values so the search dropdown uses exact strings.
    const sampleForTypes = await searchIdxListings({ limit: 50 })
    const subTypesSeen = Array.from(
      new Set(sampleForTypes.map((l: any) => l.PropertySubType).filter(Boolean))
    ).sort()

    return NextResponse.json({
      ok: true,
      dataset: process.env.BRIDGE_DATASET_ID || "miamire",
      returned: listings.length,
      subTypesSeen,
      photoTestListing: key,
      photoTestExpandLen: (withPhotos?.Media as any[])?.length ?? 0,
      directMediaRawCount: rawMedia.length,
      directMediaRawFirst: rawMedia[0] ?? null,
      directMediaUrls: urls.slice(0, 3),
      sample: listings.map(l => ({
        mlsId: l.ListingKey || l.ListingId,
        address: l.UnparsedAddress,
        city: l.City,
        state: l.StateOrProvince,
        zip: l.PostalCode,
        price: l.ListPrice,
        beds: l.BedroomsTotal,
        baths: l.BathroomsTotalDecimal,
        sqft: l.LivingArea,
        status: l.StandardStatus,
        propertyType: l.PropertyType,
        office: l.ListOfficeName,
        agent: l.ListAgentFullName,
        photoCount: l.Media?.length ?? 0,
        firstPhoto: l.Media?.[0]?.MediaURL ?? null,
      })),
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || "Bridge test failed" }, { status: 500 })
  }
}
