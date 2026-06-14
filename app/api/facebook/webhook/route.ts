export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getFacebookUserProfile, getFacebookLeadData } from "@/lib/facebook"

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
      const { leadgen_id, form_id, ad_id } = change.value || {}
      if (!leadgen_id) continue

      try {
        const fields = await getFacebookLeadData(leadgen_id)
        if (!fields) continue

        // Parse name fields — Meta returns "full_name" or separate first/last
        const fullName = fields["full_name"] || fields["name"] || ""
        const nameParts = fullName.trim().split(" ")
        const firstName = fields["first_name"] || nameParts[0] || "Facebook"
        const lastName = fields["last_name"] || nameParts.slice(1).join(" ") || "Lead"
        const email = fields["email"] || fields["email_address"] || null
        const phone = fields["phone_number"] || fields["phone"] || null

        // Find existing contact or create new one
        let contact = email
          ? await prisma.contact.findFirst({ where: { email } })
          : null
        if (!contact && phone) {
          const digits = phone.replace(/\D/g, "")
          contact = await prisma.contact.findFirst({
            where: { OR: [{ phone: { contains: digits } }, { phone2: { contains: digits } }] },
          })
        }

        if (!contact) {
          contact = await prisma.contact.create({
            data: {
              firstName,
              lastName,
              email,
              phone: phone || null,
              source: "FACEBOOK",
              facebookLeadId: leadgen_id,
              status: "LEAD",
            },
          })
        } else {
          // Update missing fields on existing contact
          await prisma.contact.update({
            where: { id: contact.id },
            data: {
              facebookLeadId: leadgen_id,
              ...(email && !contact.email ? { email } : {}),
            },
          })
        }

        await prisma.activity.create({
          data: {
            type: "FACEBOOK_LEAD",
            title: "Nuevo lead de Facebook Ads",
            description: `Formulario enviado — ${firstName} ${lastName}${email ? ` (${email})` : ""}`,
            contactId: contact.id,
          },
        })
      } catch (e) {
        console.error("[FB leadgen]", e)
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
