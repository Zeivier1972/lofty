export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { ingestLead } from "@/lib/lead-ingest"

// Google Ads Lead Form Extensions webhook
// Google sends a POST with lead data and expects { lead_id: "..." } back within 3s
export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Google Ads lead form field names
    const userColumnData: Array<{ column_id: string; string_value?: string }> = body.user_column_data || []

    const getField = (id: string) => userColumnData.find(f => f.column_id === id)?.string_value

    const firstName = getField("FIRST_NAME") || body.first_name || "Lead"
    const lastName = getField("LAST_NAME") || body.last_name
    const email = getField("EMAIL") || body.email
    const phone = getField("PHONE_NUMBER") || body.phone_number
    const city = getField("CITY") || body.city
    const zip = getField("ZIP_CODE") || body.zip_code
    const campaign = body.campaign_name || body.campaign_id

    if (!email && !phone) {
      // Still return success to Google — we just can't create a contact
      return NextResponse.json({ lead_id: body.lead_id || "received" })
    }

    const result = await ingestLead({
      firstName,
      lastName,
      email,
      phone,
      source: "GOOGLE_ADS",
      campaign,
      location: city || zip,
      smsConsent: !!phone,
    })

    // Google requires this response format
    return NextResponse.json({ lead_id: body.lead_id || result.contactId })
  } catch (e: any) {
    console.error("[Google Ads lead] Error:", e)
    return NextResponse.json({ lead_id: "error" }, { status: 200 }) // Always 200 to Google
  }
}

// Google verifies the endpoint with GET
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get("google_lead_form_webhook_token")
  // Return the token to verify ownership
  if (token) return new Response(token, { status: 200 })
  return NextResponse.json({ status: "ok" })
}
