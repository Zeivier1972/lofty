export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Public: a visitor saves a search on /homes. Creates/finds the Contact (lead
// capture) and stores the criteria so the daily cron can email new matches.
export async function POST(req: Request) {
  try {
    const b = await req.json()
    const { label, city, zip, minPrice, maxPrice, minBeds, minBaths, type, contactId, firstName, lastName, email, phone } = b || {}

    let contact = contactId ? await prisma.contact.findUnique({ where: { id: contactId } }) : null
    if (!contact) {
      const em = (email || "").trim() || null
      const ph = (phone || "").trim() || null
      if (!em && !ph) return NextResponse.json({ error: "Necesitamos tu email o teléfono." }, { status: 400 })
      const or: any[] = []
      if (em) or.push({ email: em })
      if (ph) or.push({ phone: ph })
      contact = await prisma.contact.findFirst({ where: { OR: or } })
      if (!contact) {
        contact = await prisma.contact.create({
          data: {
            firstName: (firstName || "").trim() || "Lead",
            lastName: (lastName || "").trim() || (ph || "Web"),
            email: em, phone: ph,
            source: "IDX_SAVED_SEARCH", status: "NEW_LEAD",
          },
        })
      }
    }

    const num = (v: any) => (v != null && v !== "" && !isNaN(Number(v)) ? Number(v) : null)
    const saved = await prisma.savedSearch.create({
      data: {
        contactId: contact.id,
        label: (label || "").toString().slice(0, 120) || "Búsqueda guardada",
        city: city || null,
        zip: zip || null,
        minPrice: num(minPrice),
        maxPrice: num(maxPrice),
        minBeds: num(minBeds),
        minBaths: num(minBaths),
        propertySubType: type || null,
      },
    })

    await prisma.activity.create({
      data: { type: "SEARCH_SAVED", title: "Guardó una búsqueda", description: saved.label, contactId: contact.id },
    }).catch(() => {})
    await prisma.aINotification.create({
      data: {
        type: "SEARCH_SAVED",
        title: `🔔 ${contact.firstName} guardó una búsqueda`,
        body: `${saved.label}. Recibirá alertas automáticas de nuevas propiedades.`,
        priority: "MEDIUM",
        contactId: contact.id,
      },
    }).catch(() => {})

    return NextResponse.json({ ok: true, contactId: contact.id, firstName: contact.firstName })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "No se pudo guardar la búsqueda" }, { status: 500 })
  }
}
