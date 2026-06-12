export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { sendSMS, sendWhatsApp, sendWhatsAppTemplate } from "@/lib/sms"

export async function POST(req: Request, { params }: { params: { contactId: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { message, channel = "sms", templateSid } = await req.json()
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

    const bookingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/book`

    try {
      if (templateSid) {
        // Business-initiated: use approved WhatsApp template
        await sendWhatsAppTemplate(toNumber, templateSid, {
          "1": contact.firstName,
          "2": bookingUrl,
        })
      } else {
        // Free-form: only works within 24h window after contact messaged first
        await sendWhatsApp(toNumber, message)
      }
    } catch (e: any) {
      console.error("WhatsApp send error:", e)
      return NextResponse.json(
        { error: `WhatsApp falló: ${e?.message}. Usa una plantilla aprobada para iniciar contacto.` },
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
