export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { scoreContact } from "@/lib/scoring"

// Facebook Lead Ads webhook endpoint
// Setup in Facebook Business Manager → Webhooks → Subscribe to leadgen event
export async function GET(req: Request) {
  // Webhook verification
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
        if (!leadId) continue

        // Fetch lead data from Facebook Graph API
        let leadData: any = null
        if (process.env.FB_PAGE_ACCESS_TOKEN) {
          const fbRes = await fetch(
            `https://graph.facebook.com/v18.0/${leadId}?access_token=${process.env.FB_PAGE_ACCESS_TOKEN}`
          )
          leadData = await fbRes.json()
        }

        const fieldData: Record<string, string> = {}
        for (const f of leadData?.field_data || []) {
          fieldData[f.name] = f.values?.[0] || ""
        }

        const firstName = fieldData.first_name || fieldData.full_name?.split(" ")[0] || "Lead"
        const lastName = fieldData.last_name || fieldData.full_name?.split(" ").slice(1).join(" ") || ""
        const email = fieldData.email || null
        const phone = fieldData.phone_number || null

        const existing = email ? await prisma.contact.findFirst({ where: { email } }) : null
        if (existing) continue

        const contact = await prisma.contact.create({
          data: {
            firstName,
            lastName,
            email: email || undefined,
            phone: phone || undefined,
            source: "FACEBOOK",
            status: "LEAD",
            facebookLeadId: leadId,
            smsTCPAConsent: !!phone,
            smsTCPAConsentDate: phone ? new Date() : undefined,
            smsTCPAConsentMethod: phone ? "facebook_lead_ad" : undefined,
          },
        })

        await prisma.aINotification.create({
          data: {
            type: "NEW_LEAD",
            title: `Facebook Lead: ${firstName} ${lastName}`,
            body: `${email || phone || "No contact info"}`,
            priority: "HIGH",
            contactId: contact.id,
          },
        })

        scoreContact(contact.id).catch(() => {})
        fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ai/trigger`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trigger: "NEW_LEAD", contactId: contact.id }),
        }).catch(() => {})
      }
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("Facebook lead webhook error:", e)
    return NextResponse.json({ error: "Webhook error" }, { status: 500 })
  }
}
