export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getFacebookUserProfile, getFacebookLeadData } from "@/lib/facebook"
import { ingestLead } from "@/lib/lead-ingest"

// GET — Meta webhook verification
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get("hub.mode")
  const verifyToken = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  const expectedToken = process.env.FB_VERIFY_TOKEN || process.env.FACEBOOK_VERIFY_TOKEN
  if (mode === "subscribe" && verifyToken === expectedToken) {
    return new Response(challenge || "", { status: 200 })
  }
  return new Response("Forbidden", { status: 403 })
}

// POST — Receive Messenger messages + Lead Ad submissions
export async function POST(req: Request) {
  const body = await req.json()

  if (body.object !== "page") return NextResponse.json({ ok: true })

  for (const entry of body.entry || []) {
    const pageId = entry.id as string

    // ── Lead Ad form submissions ──────────────────────────────────────────────
    for (const change of entry.changes || []) {
      if (change.field !== "leadgen") continue
      const { leadgen_id, form_id, ad_id, campaign_name, ad_name } = change.value || {}
      if (!leadgen_id) continue

      try {
        const fields = await getFacebookLeadData(leadgen_id)
        if (!fields) continue

        const fullName = fields["full_name"] || fields["name"] || ""
        const nameParts = fullName.trim().split(" ")
        const firstName = fields["first_name"] || nameParts[0] || "Facebook"
        const lastName = fields["last_name"] || nameParts.slice(1).join(" ") || undefined

        const email = fields["email"] || fields["email_address"] || undefined
        const phone = fields["phone_number"] || fields["phone"] || undefined

        const budgetRaw = fields["budget"] || fields["budget_range"] || fields["max_budget"] || fields["price_range"]
        const budget = budgetRaw ? parseInt(budgetRaw.replace(/\D/g, "")) || undefined : undefined

        const location =
          fields["city"] || fields["zip_code"] || fields["location"] ||
          fields["area_of_interest"] || fields["interested_area"] ||
          fields["neighborhood"] || fields["area"] || fields["zone"] || undefined

        const bedroomsRaw = fields["bedrooms"] || fields["num_bedrooms"] || fields["bedroom_count"] || fields["cuartos"]
        const bedroomsMin = bedroomsRaw ? parseInt(bedroomsRaw) || undefined : undefined

        const propertyType = fields["property_type"] || fields["home_type"] || fields["type_of_property"] || fields["tipo"] || undefined

        const notes = [
          fields["timeline"] ? `Timeline: ${fields["timeline"]}` : "",
          fields["when_to_buy"] ? `Cuándo comprar: ${fields["when_to_buy"]}` : "",
          fields["pre_approved"] ? `Pre-aprobado: ${fields["pre_approved"]}` : "",
          fields["message"] || fields["comments"] || fields["notes"] || "",
        ].filter(Boolean).join(" | ") || undefined

        // Run through the full ingest pipeline: SMS + email + VAPI call + scoring + pipeline stage
        await ingestLead({
          firstName,
          lastName,
          email,
          phone,
          source: "FACEBOOK",
          campaign: campaign_name || ad_name || undefined,
          budget,
          location,
          bedroomsMin,
          propertyType,
          notes,
          facebookLeadId: leadgen_id,
          smsConsent: !!phone,
        })
      } catch (e) {
        console.error("[FB webhook leadgen]", e)
      }
    }

    // ── Messenger DMs ─────────────────────────────────────────────────────────
    for (const event of entry.messaging || []) {
      if (!event.message || event.message.is_echo) continue

      const psid = event.sender.id as string
      const text = (event.message.text as string) || "[attachment]"
      const fbMid = event.message.mid as string | undefined

      let contact = await prisma.contact.findFirst({ where: { facebookPsid: psid } })

      if (!contact) {
        const profile = await getFacebookUserProfile(psid)
        contact = await prisma.contact.create({
          data: {
            firstName: profile?.firstName || "Facebook",
            lastName: profile?.lastName || "Lead",
            facebookPsid: psid,
            source: "FACEBOOK",
          },
        })
      }

      await prisma.facebookMessage.create({
        data: {
          psid,
          pageId,
          body: text,
          direction: "INBOUND",
          status: "RECEIVED",
          messageId: fbMid,
          contactId: contact.id,
        },
      })

      await Promise.all([
        prisma.activity.create({
          data: {
            type: "FACEBOOK",
            title: "Mensaje de Facebook Messenger",
            description: text.slice(0, 120),
            contactId: contact.id,
          },
        }),
        prisma.contact.update({
          where: { id: contact.id },
          data: { lastContacted: new Date() },
        }),
      ])
    }
  }

  return NextResponse.json({ ok: true })
}


    // ── Messenger DMs ─────────────────────────────────────────────────────────
    for (const event of entry.messaging || []) {
      if (!event.message || event.message.is_echo) continue

      const psid = event.sender.id as string
      const text = (event.message.text as string) || "[attachment]"
      const fbMid = event.message.mid as string | undefined

      let contact = await prisma.contact.findFirst({ where: { facebookPsid: psid } })

      if (!contact) {
        const profile = await getFacebookUserProfile(psid)
        contact = await prisma.contact.create({
          data: {
            firstName: profile?.firstName || "Facebook",
            lastName: profile?.lastName || "Lead",
            facebookPsid: psid,
            source: "FACEBOOK",
          },
        })
      }

      await prisma.facebookMessage.create({
        data: {
          psid,
          pageId,
          body: text,
          direction: "INBOUND",
          status: "RECEIVED",
          messageId: fbMid,
          contactId: contact.id,
        },
      })

      await Promise.all([
        prisma.activity.create({
          data: {
            type: "FACEBOOK",
            title: "Mensaje de Facebook Messenger",
            description: text.slice(0, 120),
            contactId: contact.id,
          },
        }),
        prisma.contact.update({
          where: { id: contact.id },
          data: { lastContacted: new Date() },
        }),
      ])
    }
  }

  return NextResponse.json({ ok: true })
}
