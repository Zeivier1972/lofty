export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { ingestLead } from "@/lib/lead-ingest"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === process.env.FB_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }
  return new Response("Forbidden", { status: 403 })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "leadgen") continue

        const leadId = change.value?.leadgen_id
        const pageId = change.value?.page_id
        if (!leadId) continue

        // Fetch lead from Facebook Graph API
        let fieldData: Record<string, string> = {}
        let campaign = undefined
        if (process.env.FB_PAGE_ACCESS_TOKEN) {
          const fbRes = await fetch(
            `https://graph.facebook.com/v18.0/${leadId}?fields=field_data,ad_name,campaign_name&access_token=${process.env.FB_PAGE_ACCESS_TOKEN}`
          )
          const fbData = await fbRes.json()
          for (const f of fbData?.field_data || []) {
            fieldData[f.name] = f.values?.[0] || ""
          }
          campaign = fbData.campaign_name || fbData.ad_name
        }

        const firstName = fieldData.first_name || fieldData.full_name?.split(" ")[0] || "Lead"
        const lastName = fieldData.last_name || fieldData.full_name?.split(" ").slice(1).join(" ")
        const email = fieldData.email || undefined
        const phone = fieldData.phone_number || undefined

        // Budget — handle range strings like "$300k-$500k" or raw numbers
        const budgetRaw = fieldData.budget || fieldData.budget_range || fieldData.max_budget || fieldData.price_range
        const budget = budgetRaw ? parseInt(budgetRaw.replace(/\D/g, "")) || undefined : undefined

        // Location — check all common question names
        const location =
          fieldData.city || fieldData.zip_code || fieldData.location ||
          fieldData.area_of_interest || fieldData.interested_area ||
          fieldData.neighborhood || fieldData.area || fieldData.zone ||
          // Fall back to campaign name stripped of year/quarter
          (!fieldData.city && campaign ? campaign.replace(/\b(20\d\d|Q[1-4]|H[12])\b/gi, "").trim() : undefined)

        // Bedrooms
        const bedroomsRaw = fieldData.bedrooms || fieldData.num_bedrooms || fieldData.bedroom_count || fieldData.cuartos
        const bedroomsMin = bedroomsRaw ? parseInt(bedroomsRaw) || undefined : undefined

        // Property type
        const propertyType = fieldData.property_type || fieldData.home_type || fieldData.type_of_property || fieldData.tipo

        // Extra context from custom form questions
        const notes = [
          fieldData.timeline ? `Timeline: ${fieldData.timeline}` : "",
          fieldData.when_to_buy ? `Cuándo comprar: ${fieldData.when_to_buy}` : "",
          fieldData.pre_approved ? `Pre-aprobado: ${fieldData.pre_approved}` : "",
          fieldData.message || fieldData.comments || fieldData.notes || "",
        ].filter(Boolean).join(" | ") || undefined

        await ingestLead({
          firstName,
          lastName,
          email,
          phone,
          source: "FACEBOOK",
          campaign,
          budget,
          location,
          bedroomsMin,
          propertyType,
          notes,
          facebookLeadId: leadId,
          smsConsent: !!phone,
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[Facebook lead] Error:", e)
    return NextResponse.json({ error: "Webhook error" }, { status: 500 })
  }
}
