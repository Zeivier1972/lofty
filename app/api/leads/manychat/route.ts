export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { ingestLead } from "@/lib/lead-ingest"

// ManyChat sends subscriber data via External Request action
// Fields depend on what you map in the ManyChat flow
export async function POST(req: Request) {
  try {
    const body = await req.json()

    // ManyChat field names (vary by setup — normalize common patterns)
    const firstName = body.first_name || body.firstName || body.name?.split(" ")[0] || "Lead"
    const lastName = body.last_name || body.lastName || (body.name?.includes(" ") ? body.name.split(" ").slice(1).join(" ") : undefined)
    const email = body.email || body.email_address
    const phone = body.phone || body.phone_number || body.optin_phone
    const message = body.last_input_text || body.message || body.notes
    const campaign = body.campaign || body.source || body.ref // ManyChat ref param from ads

    if (!email && !phone) {
      return NextResponse.json({ error: "Email or phone required" }, { status: 400 })
    }

    const result = await ingestLead({
      firstName,
      lastName,
      email,
      phone,
      source: "MANYCHAT",
      campaign,
      message,
      smsConsent: !!phone,
    })

    // ManyChat expects specific response format for flow continuation
    return NextResponse.json({ success: true, ...result, version: "v2" })
  } catch (e: any) {
    console.error("[ManyChat lead] Error:", e)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
