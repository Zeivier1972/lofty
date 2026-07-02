export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { fetchListings, fetchListingMedia } from "@/lib/bridge"

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
    // Confirm photos: pull real URLs from the Media resource for the listing that has photos.
    const withPhotos: any = listings.find(l => ((l as any).PhotosCount ?? (l.Media as any[])?.length ?? 0) > 0)
    const directMediaUrls = withPhotos
      ? await fetchListingMedia(withPhotos.ListingKey || withPhotos.ListingId)
      : []
    return NextResponse.json({
      ok: true,
      dataset: process.env.BRIDGE_DATASET_ID || "miamire",
      returned: listings.length,
      photoTestListing: withPhotos ? (withPhotos.ListingKey || withPhotos.ListingId) : null,
      directMediaCount: directMediaUrls.length,
      directMediaFirst3: directMediaUrls.slice(0, 3),
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
