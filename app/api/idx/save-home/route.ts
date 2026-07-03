export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { fetchListingByKey, bridgeToProperty, buildDisplayAddress } from "@/lib/bridge"

// Public: a site visitor saves (favorites) an IDX listing. Creates/finds the
// Contact (lead capture), upserts the listing into Property, records a
// PropertySave + Activity + a Sofia notification for the agent.
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { listingKey, contactId, firstName, lastName, email, phone, remove } = body || {}
    if (!listingKey) return NextResponse.json({ error: "listingKey requerido" }, { status: 400 })

    // 1. Resolve the contact (lead capture)
    let contact = contactId ? await prisma.contact.findUnique({ where: { id: contactId } }) : null
    if (!contact) {
      const em = (email || "").trim() || null
      const ph = (phone || "").trim() || null
      if (!em && !ph) return NextResponse.json({ error: "Necesitamos tu email o teléfono para guardar." }, { status: 400 })
      const or: any[] = []
      if (em) or.push({ email: em })
      if (ph) or.push({ phone: ph })
      contact = await prisma.contact.findFirst({ where: { OR: or } })
      if (!contact) {
        contact = await prisma.contact.create({
          data: {
            firstName: (firstName || "").trim() || "Lead",
            lastName: (lastName || "").trim() || (ph || "Web"),
            email: em,
            phone: ph,
            source: "IDX_HOMES",
            status: "NEW_LEAD",
          },
        })
      }
    }

    // 2. Upsert the listing into Property (non-fatal)
    let propertyId: string | null = null
    let address = String(listingKey)
    let price: number | null = null
    try {
      const listing = await fetchListingByKey(listingKey)
      if (listing) {
        address = buildDisplayAddress(listing)
        price = listing.ListPrice ?? null
        const data = bridgeToProperty(listing)
        if (data.mlsId) {
          const existing = await prisma.property.findFirst({ where: { mlsId: data.mlsId } })
          if (existing) {
            await prisma.property.update({ where: { id: existing.id }, data })
            propertyId = existing.id
          } else {
            const created = await prisma.property.create({ data })
            propertyId = created.id
          }
        }
      }
    } catch (e) {
      console.error("[idx/save-home] Property upsert failed:", e)
    }

    // 3. Toggle the save
    if (propertyId) {
      if (remove) {
        await prisma.propertySave.updateMany({
          where: { contactId: contact.id, propertyId },
          data: { isActive: false },
        }).catch(() => {})
      } else {
        await prisma.propertySave.upsert({
          where: { contactId_propertyId: { contactId: contact.id, propertyId } },
          create: { contactId: contact.id, propertyId, isActive: true },
          update: { isActive: true },
        }).catch(() => {})
      }
    }

    // 4. Log activity + notify the agent (only when saving)
    if (!remove) {
      const label = `${address}${price ? ` — $${Number(price).toLocaleString()}` : ""}`
      await prisma.activity.create({
        data: {
          type: "PROPERTY_SAVED",
          title: "Guardó una propiedad en la web",
          description: label,
          contactId: contact.id,
        },
      }).catch(() => {})
      await prisma.aINotification.create({
        data: {
          type: "PROPERTY_SAVED",
          title: `💜 ${contact.firstName} guardó una propiedad`,
          body: `${label}. Buen momento para hacer seguimiento.`,
          priority: "MEDIUM",
          contactId: contact.id,
        },
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true, contactId: contact.id, firstName: contact.firstName })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "No se pudo guardar" }, { status: 500 })
  }
}
