export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { sendSMS } from "@/lib/sms"

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
  const fromNumber = process.env.TWILIO_PHONE_NUMBER || ""

  if (channel === "whatsapp") {
    // Attempt WhatsApp send
    try {
      const twilio = require("twilio")(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
      await twilio.messages.create({
        from: `whatsapp:${fromNumber}`,
        to: `whatsapp:${toNumber}`,
        body: message,
      })
    } catch (e) {
      console.error("WhatsApp send error:", e)
    }

    await prisma.whatsAppMessage.create({
      data: {
        body: message,
        fromNumber,
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
