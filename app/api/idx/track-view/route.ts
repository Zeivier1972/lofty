export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { fetchListingByKey, bridgeToProperty } from "@/lib/bridge"

// Logs a listing view for a KNOWN lead (contactId from the browser). Only tracks
// identified leads — that's the meaningful "clicked N times" signal.
export async function POST(req: Request) {
  try {
    const { listingKey, contactId } = await req.json()
    if (!listingKey || !contactId) return NextResponse.json({ ok: true, skipped: true })

    const contact = await prisma.contact.findUnique({ where: { id: contactId }, select: { id: true } })
    if (!contact) return NextResponse.json({ ok: true, skipped: true })

    const listing = await fetchListingByKey(listingKey)
    if (!listing) return NextResponse.json({ ok: true, skipped: true })
    const data = bridgeToProperty(listing)
    if (!data.mlsId) return NextResponse.json({ ok: true, skipped: true })

    const existing = await prisma.property.findFirst({ where: { mlsId: data.mlsId }, select: { id: true } })
    const propertyId = existing ? existing.id : (await prisma.property.create({ data })).id

    await prisma.propertyView.create({ data: { contactId: contact.id, propertyId } }).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}
