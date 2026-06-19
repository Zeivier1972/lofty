export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { ingestLead } from "@/lib/lead-ingest"

// Zapier sends a POST with any field names — normalize them all
function normalize(body: Record<string, any>) {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const val = body[k] || body[k.toLowerCase()] || body[k.toUpperCase()]
      if (val && String(val).trim()) return String(val).trim()
    }
    return undefined
  }

  const firstName = get("firstName", "first_name", "firstname", "fname", "name")?.split(" ")[0] || "Lead"
  const rawName = get("firstName", "first_name", "firstname", "fname", "name") || ""
  const lastName = get("lastName", "last_name", "lastname", "lname") ||
    (rawName.includes(" ") ? rawName.split(" ").slice(1).join(" ") : undefined)

  const email = get("email", "email_address", "emailAddress", "Email")
  const phone = get("phone", "phone_number", "phoneNumber", "mobile", "cell", "Phone", "phone1")
  const source = get("source", "lead_source", "leadSource", "Source") || "ZAPIER"
  const campaign = get("campaign", "campaign_name", "campaignName", "ad_campaign", "utm_campaign")
  const message = get("message", "notes", "comment", "inquiry", "body")
  const budget = get("budget", "price_range", "priceRange", "max_budget")
  const location = get("location", "area", "city", "neighborhood", "zip")
  const propertyType = get("property_type", "propertyType", "type")

  return {
    firstName,
    lastName,
    email,
    phone,
    source: source.toUpperCase(),
    campaign,
    message,
    budget: budget ? parseInt(String(budget).replace(/\D/g, "")) || null : null,
    location,
    propertyType,
    smsConsent: !!phone, // Zapier leads with phone implicitly consent
  }
}

export async function POST(req: Request) {
  // Optional secret check
  const secret = process.env.ZAPIER_SECRET
  if (secret) {
    const headerSecret = req.headers.get("x-zapier-secret") || new URL(req.url).searchParams.get("secret")
    if (headerSecret !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  try {
    let body: Record<string, any> = {}
    const contentType = req.headers.get("content-type") || ""

    if (contentType.includes("application/json")) {
      body = await req.json()
    } else {
      // Form-encoded or plain text
      const text = await req.text()
      try { body = JSON.parse(text) } catch {
        const params = new URLSearchParams(text)
        params.forEach((v, k) => { body[k] = v })
      }
    }

    const data = normalize(body)

    if (!data.email && !data.phone) {
      return NextResponse.json({ error: "Email or phone required" }, { status: 400 })
    }

    const result = await ingestLead(data)
    return NextResponse.json({ success: true, ...result })
  } catch (e: any) {
    console.error("[Zapier lead] Error:", e)
    return NextResponse.json({ error: "Failed to process lead" }, { status: 500 })
  }
}

// Zapier checks the endpoint with GET to confirm it's alive
export async function GET() {
  return NextResponse.json({ status: "ok", endpoint: "Casai Zapier Lead Webhook" })
}
