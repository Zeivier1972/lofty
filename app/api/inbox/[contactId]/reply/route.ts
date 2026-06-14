export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { sendSMS, sendWhatsApp, sendWhatsAppTemplate } from "@/lib/sms"
import { sendFacebookMessage } from "@/lib/facebook"

export async function POST(req: Request, { params }: { params: { contactId: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { message, channel = "sms", templateSid, mediaUrl } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: "Message required" }, { status: 400 })

  const contact = await prisma.contact.findUnique({
    where: { id: params.contactId },
    select: { id: true, phone: true, firstName: true, lastName: true, facebookPsid: true },
  })
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 })

  // ── Facebook Messenger ───────────────────────────────────────────────────────
  if (channel === "facebook") {
    if (!contact.facebookPsid) {
      return NextResponse.json({ error: "Este contacto no tiene cuenta de Facebook Messenger vinculada" }, { status: 400 })
    }
    const msgId = await sendFacebookMessage(contact.facebookPsid, message)
    await prisma.facebookMessage.create({
      data: {
        psid: contact.facebookPsid,
        pageId: process.env.FACEBOOK_PAGE_ID || process.env.FB_PAGE_ID || "",
        body: message,
        direction: "OUTBOUND",
        status: msgId ? "SENT" : "FAILED",
        messageId: msgId || undefined,
        contactId: contact.id,
      },
    })
    await Promise.all([
      prisma.activity.create({
        data: {
          type: "FACEBOOK",
          title: "Mensaje enviado por Messenger",
          description: message.slice(0, 120),
          contactId: contact.id,
          userId: session.user?.id as string,
        },
      }),
      prisma.contact.update({ where: { id: contact.id }, data: { lastContacted: new Date() } }),
    ])
    return NextResponse.json({ success: true })
  }

  // ── Require phone for SMS / WhatsApp ─────────────────────────────────────────
  if (!contact.phone) return NextResponse.json({ error: "Contact has no phone number" }, { status: 400 })

  const toNumber = contact.phone.startsWith("+") ? contact.phone : `+1${contact.phone.replace(/\D/g, "")}`
  const fromNumber = process.env.TWILIO_PHONE_NUMBER || ""
  const waFromNumber = process.env.TWILIO_WHATSAPP_NUMBER || fromNumber

  // ── WhatsApp ─────────────────────────────────────────────────────────────────
  if (channel === "whatsapp") {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      return NextResponse.json({ error: "WhatsApp not configured: TWILIO credentials missing" }, { status: 503 })
    }
    try {
      if (templateSid) {
        await sendWhatsAppTemplate(toNumber, templateSid, { "1": contact.firstName })
      } else {
        await sendWhatsApp(toNumber, message, mediaUrl || undefined)
      }
    } catch (e: any) {
      return NextResponse.json(
        { error: `WhatsApp falló: ${e?.message}. Usa una plantilla aprobada para iniciar contacto.` },
        { status: 502 }
      )
    }
    await prisma.whatsAppMessage.create({
      data: { body: message, fromNumber: waFromNumber, toNumber, direction: "OUTBOUND", status: "SENT", contactId: contact.id },
    })
  } else {
    // ── SMS ───────────────────────────────────────────────────────────────────
    await sendSMS(toNumber, message, mediaUrl ? [mediaUrl] : undefined)
    await prisma.sMSMessage.create({
      data: { body: message, fromNumber, toNumber, direction: "OUTBOUND", status: "SENT", contactId: contact.id },
    })
  }

  await Promise.all([
    prisma.activity.create({
      data: {
        type: channel === "whatsapp" ? "WHATSAPP" : "SMS",
        title: channel === "whatsapp" ? "WhatsApp enviado" : "SMS enviado",
        description: message.slice(0, 120),
        contactId: contact.id,
        userId: session.user?.id as string,
      },
    }),
    prisma.contact.update({ where: { id: contact.id }, data: { lastContacted: new Date() } }),
  ])

  return NextResponse.json({ success: true })
}
