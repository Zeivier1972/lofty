export const dynamic = "force-dynamic"

/**
 * Facebook / Instagram comment webhook
 *
 * Facebook sends comment events here when someone comments on your posts.
 * If the comment contains a trigger keyword (INVERSIÓN, CASA, GRATIS, LISTO),
 * Sofia DMs them the lead magnet automatically.
 *
 * Setup in Facebook Developer Console:
 * 1. App Dashboard → Webhooks → Subscribe to: feed (FB comments), comments (IG)
 * 2. Callback URL: https://yourapp.com/api/webhooks/social-comments
 * 3. Verify Token: value of WEBHOOK_VERIFY_TOKEN env var
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { detectKeyword, deliverLeadMagnet } from "@/lib/lead-magnet-delivery"

// ── Webhook verification (Facebook handshake) ─────────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === process.env.FB_VERIFY_TOKEN) {
    console.log("[social-comments webhook] Verified successfully")
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse("Forbidden", { status: 403 })
}

// ── Incoming events ───────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Facebook sends array of entry objects
    const entries = body.entry ?? []

    for (const entry of entries) {
      // ── Facebook page comment events ──────────────────────────────────────
      const changes = entry.changes ?? []
      for (const change of changes) {
        if (change.field === "feed" && change.value?.item === "comment") {
          await handleFacebookComment(change.value)
        }
        // Instagram comment events
        if (change.field === "comments") {
          await handleInstagramComment(change.value, entry.id)
        }
      }

      // ── Instagram messaging (DM) ──────────────────────────────────────────
      const messaging = entry.messaging ?? []
      for (const event of messaging) {
        if (event.message?.text) {
          await handleInstagramDM(event)
        }
      }
    }

    return new NextResponse("OK", { status: 200 })
  } catch (e: any) {
    console.error("[social-comments webhook] Error:", e.message)
    return new NextResponse("OK", { status: 200 }) // Always 200 to Facebook
  }
}

// ─── Facebook comment handler ─────────────────────────────────────────────────

async function handleFacebookComment(value: any) {
  const commentText: string = value.message ?? ""
  const commenterPsid: string = value.from?.id ?? ""
  const commenterName: string = value.from?.name ?? ""

  if (!commentText || !commenterPsid) return

  const keyword = await detectKeyword(commentText)
  if (!keyword) return

  console.log(`[social-comments] FB comment keyword "${keyword}" from ${commenterName} (${commenterPsid})`)

  // Find or create contact by Facebook PSID
  let contact = await prisma.contact.findFirst({ where: { facebookPsid: commenterPsid } })
  if (!contact) {
    const [firstName, ...rest] = commenterName.split(" ")
    contact = await prisma.contact.create({
      data: {
        firstName: firstName || commenterName,
        lastName: rest.join(" ") || "",
        source: "FACEBOOK_COMMENT",
        facebookPsid: commenterPsid,
        status: "LEAD",
      },
    })
  }

  await deliverLeadMagnet(keyword, {
    id: contact.id,
    firstName: contact.firstName,
    phone: contact.phone,
    email: contact.email,
    facebookPsid: commenterPsid,
  }, { sms: true, email: true, fbDm: true, igDm: false })
}

// ─── Instagram comment handler ────────────────────────────────────────────────

async function handleInstagramComment(value: any, pageId: string) {
  const commentText: string = value.text ?? ""
  const igsid: string = value.from?.id ?? ""
  const commenterName: string = value.from?.username ?? value.from?.name ?? ""

  if (!commentText || !igsid) return

  const keyword = await detectKeyword(commentText)
  if (!keyword) return

  console.log(`[social-comments] IG comment keyword "${keyword}" from @${commenterName} (${igsid})`)

  let contact = await prisma.contact.findFirst({ where: { instagramIgsid: igsid } })
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        firstName: commenterName || "Instagram",
        lastName: "",
        source: "INSTAGRAM_COMMENT",
        instagramIgsid: igsid,
        status: "LEAD",
      },
    })
  }

  await deliverLeadMagnet(keyword, {
    id: contact.id,
    firstName: contact.firstName,
    phone: contact.phone,
    email: contact.email,
    instagramIgsid: igsid,
  }, { sms: true, email: true, fbDm: false, igDm: true })
}

// ─── Instagram DM handler ─────────────────────────────────────────────────────

async function handleInstagramDM(event: any) {
  const igsid: string = event.sender?.id ?? ""
  const messageText: string = event.message?.text ?? ""

  if (!igsid || !messageText) return

  const keyword = await detectKeyword(messageText)
  if (!keyword) return

  console.log(`[social-comments] IG DM keyword "${keyword}" from ${igsid}`)

  let contact = await prisma.contact.findFirst({ where: { instagramIgsid: igsid } })
  if (!contact) {
    contact = await prisma.contact.create({
      data: { firstName: "Instagram", lastName: "", source: "INSTAGRAM_DM", instagramIgsid: igsid, status: "LEAD" },
    })
  }

  await deliverLeadMagnet(keyword, {
    id: contact.id,
    firstName: contact.firstName,
    phone: contact.phone,
    email: contact.email,
    instagramIgsid: igsid,
  }, { sms: true, email: true, fbDm: false, igDm: true })
}
