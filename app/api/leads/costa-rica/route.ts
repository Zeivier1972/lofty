export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { ingestLead } from "@/lib/lead-ingest"

// Public capture for the Costa Rica investor landing page. Tags the lead
// "Inversionista Costa Rica" so it auto-enrolls in the matching Smart Plan —
// same tag Facebook lead-ads produce via utm_campaign.
export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}))
    const firstName = String(b.firstName || b.name || "").trim()
    if (!firstName || (!b.email && !b.phone)) {
      return NextResponse.json({ error: "Nombre y correo o teléfono son requeridos" }, { status: 400 })
    }
    const { contactId, isNew } = await ingestLead({
      firstName,
      lastName: b.lastName ? String(b.lastName).trim() : undefined,
      email: b.email ? String(b.email).trim() : undefined,
      phone: b.phone ? String(b.phone).trim() : undefined,
      source: "WEBSITE",
      campaign: "Inversionista Costa Rica",
      message: b.message ? String(b.message).trim() : "Interesado en invertir en Miami desde Costa Rica (One Twenty Brickell).",
      smsConsent: !!b.smsConsent,
      tags: ["Inversionista Costa Rica"],
    })
    return NextResponse.json({ ok: true, contactId, isNew })
  } catch (e) {
    console.error("[costa-rica capture]", e)
    return NextResponse.json({ error: "No se pudo enviar. Intenta de nuevo." }, { status: 500 })
  }
}
