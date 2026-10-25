export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseSignedRequest } from "@/lib/facebook-signed-request"

/**
 * Meta's Data Deletion Callback.
 *
 * Paste this URL into the app dashboard under Settings → Basic → User Data
 * Deletion → "Data Deletion Callback URL". When someone removes the app from
 * their Facebook account, Meta POSTs a `signed_request` here and expects JSON
 * back: { url, confirmation_code }.
 *
 * Meta's docs: the signed_request is "<base64url signature>.<base64url payload>",
 * where the signature is an HMAC-SHA256 of the raw payload segment keyed with
 * the app secret.
 *
 * What this deletes: the Facebook/Instagram conversation data the app itself
 * collected for that Meta user id. What it does NOT delete: the CRM contact
 * record, which may be tied to a closed transaction Florida law requires us to
 * retain. That record is unlinked from the Meta id, opted out of every channel,
 * and flagged for Catherine to review inside the 30-day window.
 */

export async function POST(req: Request) {
  const appSecret = process.env.FACEBOOK_APP_SECRET
  if (!appSecret) {
    console.error("[FB DELETION] FACEBOOK_APP_SECRET is not set")
    return NextResponse.json({ error: "Not configured" }, { status: 500 })
  }

  // Meta sends this form-encoded, but accept JSON too so the endpoint can be
  // exercised by hand.
  let signed = ""
  const contentType = req.headers.get("content-type") || ""
  try {
    if (contentType.includes("application/json")) {
      const body = await req.json()
      signed = typeof body?.signed_request === "string" ? body.signed_request : ""
    } else {
      const form = await req.formData()
      signed = String(form.get("signed_request") || "")
    }
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  if (!signed) {
    return NextResponse.json({ error: "Missing signed_request" }, { status: 400 })
  }

  const data = parseSignedRequest(signed, appSecret)
  if (!data?.user_id) {
    return NextResponse.json({ error: "Invalid signed_request" }, { status: 400 })
  }

  const metaUserId = data.user_id

  // ── Delete the data the app collected for this Meta user ──────────────────
  let deletedMessages = 0
  let deletedConversations = 0
  try {
    deletedMessages = (await prisma.facebookMessage.deleteMany({ where: { psid: metaUserId } })).count
  } catch (e) {
    console.error("[FB DELETION] facebookMessage delete failed:", e)
  }
  try {
    deletedConversations = (
      await prisma.instagramConversation.deleteMany({ where: { igUserId: metaUserId } })
    ).count
  } catch (e) {
    console.error("[FB DELETION] instagramConversation delete failed:", e)
  }

  // ── Unlink and silence any CRM contact carrying that Meta id ──────────────
  const linked = await prisma.contact
    .findMany({
      where: { OR: [{ facebookPsid: metaUserId }, { instagramIgsid: metaUserId }] },
      select: { id: true },
    })
    .catch(() => [] as { id: string }[])

  if (linked.length) {
    await prisma.contact
      .updateMany({
        where: { id: { in: linked.map(c => c.id) } },
        data: {
          facebookPsid: null,
          instagramIgsid: null,
          doNotCall: true,
          doNotEmail: true,
          doNotText: true,
        },
      })
      .catch(e => console.error("[FB DELETION] contact unlink failed:", e))
  }

  const notification = await prisma.aINotification.create({
    data: {
      type: "DATA_DELETION",
      priority: "HIGH",
      title: "Eliminación de datos solicitada desde Facebook",
      body:
        `Meta user ${metaUserId} eliminó la app. Borrados ${deletedMessages} mensaje(s) de Messenger ` +
        `y ${deletedConversations} conversación(es) de Instagram. ` +
        (linked.length
          ? `${linked.length} contacto(s) del CRM desvinculados y dados de baja — revisa si procede borrarlos.`
          : "Sin contactos vinculados en el CRM."),
      contactId: linked[0]?.id ?? null,
      metadata: JSON.stringify({
        source: "META_CALLBACK",
        metaUserId,
        deletedMessages,
        deletedConversations,
        unlinkedContactIds: linked.map(c => c.id),
        requestedAt: new Date().toISOString(),
      }),
    },
  })

  console.log(
    `[FB DELETION] ${notification.id} — meta user ${metaUserId} — ${deletedMessages} msgs, ` +
      `${deletedConversations} convos, ${linked.length} contact(s) unlinked`,
  )

  // Meta shows this URL to the person so they can check on the request.
  return NextResponse.json({
    url: `https://www.catherinegomezrealtor.com/data-deletion?code=${notification.id}`,
    confirmation_code: notification.id,
  })
}

/** Convenience for a browser hitting the URL directly — Meta only ever POSTs. */
export async function GET() {
  return NextResponse.redirect("https://www.catherinegomezrealtor.com/data-deletion", 302)
}
