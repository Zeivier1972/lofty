export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { fetchListingByKey, fetchListingMedia, buildDisplayAddress } from "@/lib/bridge"

// CORS: allow partner apps (e.g. Easy Rental) to consume this endpoint from the browser
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

// Public IDX single-listing detail (with all photos + attribution info).
export async function GET(_req: Request, { params }: { params: { key: string } }) {
  try {
    const l = await fetchListingByKey(params.key)
    if (!l) return NextResponse.json({ ok: false, error: "Listing not found" }, { status: 404, headers: CORS_HEADERS })

    const photos = await fetchListingMedia(params.key)

    return NextResponse.json({
      ok: true,
      listing: {
        listingKey: l.ListingKey,
        mlsNumber: l.ListingId ?? null,
        address: buildDisplayAddress(l),
        city: l.City ?? null,
        state: l.StateOrProvince ?? null,
        zip: l.PostalCode ?? null,
        price: l.ListPrice ?? null,
        beds: l.BedroomsTotal ?? null,
        baths: l.BathroomsTotalDecimal ?? null,
        sqft: l.LivingArea ?? null,
        yearBuilt: l.YearBuilt ?? null,
        propertyType: l.PropertyType ?? null,
        subType: l.PropertySubType ?? null,
        status: l.StandardStatus ?? null,
        description: l.PublicRemarks ?? null,
        hoa: l.AssociationFee ?? null,
        taxes: l.TaxAnnualAmount ?? null,
        daysOnMarket: l.DaysOnMarket ?? null,
        pool: l.PoolPrivateYN ?? null,
        garage: l.GarageSpaces ?? null,
        office: l.ListOfficeName ?? null,
        agent: l.ListAgentFullName ?? null,
        modified: l.ModificationTimestamp ?? null,
        photos,
      },
    }, { headers: CORS_HEADERS })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || "Listing fetch failed" }, { status: 500, headers: CORS_HEADERS })
  }
}
