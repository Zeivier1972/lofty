export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { triggerOutboundCall } from "@/lib/vapi"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { contactId, phone, name } = await req.json()
    if (!contactId || !phone) {
      return NextResponse.json({ error: "contactId and phone required" }, { status: 400 })
    }

    const contact = await prisma.contact.findUnique({ where: { id: contactId } })
    if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 })

    const toPhone = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "").slice(-10)}`

    const callId = await triggerOutboundCall({
      toPhone,
      contactId,
      contactName: name || `${contact.firstName} ${contact.lastName || ""}`.trim(),
      budgetMax: contact.buyerBudgetMax ?? null,
      budgetMin: contact.buyerBudgetMin ?? null,
      location: contact.buyerLocation ?? null,
      bedrooms: contact.buyerBedroomsMin ?? null,
      propertyType: contact.buyerPropertyType ?? null,
      skipBusinessHoursCheck: true,
      isManual: true,
    })

    if (!callId) {
      return NextResponse.json({ error: "La llamada no se pudo iniciar — revisa los logs de Railway" }, { status: 500 })
    }

    return NextResponse.json({ callId })
  } catch (e: any) {
    console.error("[VAPI call] Error:", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
