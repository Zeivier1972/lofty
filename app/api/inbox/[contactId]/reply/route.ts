export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { sendSMS, sendWhatsApp } from "@/lib/sms"

export async function POST(req: Request, { params }: { params: { contactId: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { message, channel = "sms" } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: "Message required" }, { status: 400 })

  const contact = await prisma.contact.findUnique({
    where: { id: params.contactId },
    select: { id: true, phone: true, firstName: true, lastName: true },
  })
  if (!contact?.phone) return NextResponse.json({ error: "Contact has no phone number" }, { status: 400 })

  const toNumber = contact.phone.startsWith("+") ? contact.phone : `+1${contact.phone.replace(/\D/g, "")}`
  // WhatsApp may use a separate number (Sandbox or Business); falls back to the SMS number
  const fromNumber = process.env.TWILIO_PHONE_NUMBER || ""
  const waFromNumber = process.env.TWILIO_WHATSAPP_NUMBER || fromNumber

  if (channel === "whatsapp") {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      return NextResponse.json({ error: "WhatsApp not configured: TWILIO credentials missing" }, { status: 503 })
    }

    let sendError: string | null = null
    try {
      await sendWhatsApp(toNumber, message)
    } catch (e: any) {
      console.error("WhatsApp send error:", e)
      sendError = e?.message || "WhatsApp send failed"
    }

    if (sendError) {
      return NextResponse.json(
        { error: `WhatsApp delivery failed: ${sendError}. Make sure your Twilio number is WhatsApp-enabled (Sandbox or Business API) and set TWILIO_WHATSAPP_NUMBER in Railway if it differs from TWILIO_PHONE_NUMBER.` },
        { status: 502 }
      )
    }

    await prisma.whatsAppMessage.create({
      data: {
        body: message,
        fromNumber: waFromNumber,
        toNumber,
        direction: "OUTBOUND",
        status: "SENT",
        contactId: contact.id,
      },
    })
  } else {
    // SMS
    await sendSMS(toNumber, message)
    await prisma.sMSMessage.create({
      data: {
        body: message,
        fromNumber,
        toNumber,
        direction: "OUTBOUND",
        status: "SENT",
        contactId: contact.id,
      },
    })
  }

  // Log activity + update lastContacted
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
    prisma.contact.update({
      where: { id: contact.id },
      data: { lastContacted: new Date() },
    }),
  ])

  return NextResponse.json({ success: true })
}
