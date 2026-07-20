export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { partnerOwnsContact } from "@/lib/partner-auth"

// A partner updates the buyer preferences of one of THEIR referred leads.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const contactId: string = body.contactId
  if (!contactId) return NextResponse.json({ error: "contactId requerido" }, { status: 400 })
  if (!(await partnerOwnsContact(contactId))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const num = (v: any) => (v == null || v === "" ? null : Number(v))
  const data: any = {}
  if (body.buyerLocation !== undefined) data.buyerLocation = (body.buyerLocation || "").toString().trim() || null
  if (body.buyerBudgetMin !== undefined) data.buyerBudgetMin = num(body.buyerBudgetMin)
  if (body.buyerBudgetMax !== undefined) data.buyerBudgetMax = num(body.buyerBudgetMax)
  if (body.buyerBedroomsMin !== undefined) data.buyerBedroomsMin = num(body.buyerBedroomsMin)
  if (body.buyerPropertyType !== undefined) data.buyerPropertyType = (body.buyerPropertyType || "").toString().trim() || null
  if (body.buyerTimelineMonths !== undefined) data.buyerTimelineMonths = num(body.buyerTimelineMonths)
  data.matchPrefsCompletedAt = new Date()

  const contact = await prisma.contact.update({
    where: { id: contactId },
    data,
    select: {
      id: true, buyerLocation: true, buyerBudgetMin: true, buyerBudgetMax: true,
      buyerBedroomsMin: true, buyerPropertyType: true, buyerTimelineMonths: true,
    },
  })

  // Log so the agent sees the partner changed the lead's criteria.
  await prisma.activity.create({
    data: { contactId, type: "NOTE_ADDED", title: "Preferencias del comprador actualizadas por el socio" },
  }).catch(() => {})

  return NextResponse.json({ ok: true, contact })
}
