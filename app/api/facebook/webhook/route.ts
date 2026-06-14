export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getFacebookUserProfile } from "@/lib/facebook"

// GET — Meta webhook verification
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get("hub.mode")
  const verifyToken = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && verifyToken === process.env.FACEBOOK_VERIFY_TOKEN) {
    return new Response(challenge || "", { status: 200 })
  }
  return new Response("Forbidden", { status: 403 })
}

// POST — Receive Messenger events
export async function POST(req: Request) {
  const body = await req.json()

  // Verify it's a page subscription
  if (body.object !== "page") return NextResponse.json({ ok: true })

  for (const entry of body.entry || []) {
    const pageId = entry.id as string
    for (const event of entry.messaging || []) {
      // Skip echo (our own sent messages) and delivery/read receipts
      if (!event.message || event.message.is_echo) continue

      const psid = event.sender.id as string
      const text = (event.message.text as string) || "[attachment]"
      const fbMid = event.message.mid as string | undefined

      // Find existing contact by PSID
      let contact = await prisma.contact.findFirst({ where: { facebookPsid: psid } })

      if (!contact) {
        // Try to look up their name from Graph API
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

      // Store message
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

      // Log activity + update lastContacted
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
