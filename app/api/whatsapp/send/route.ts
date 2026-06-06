export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { contactId, phoneNumber, body, mediaUrl } = await req.json()

  const toNumber = phoneNumber.startsWith("whatsapp:") ? phoneNumber : `whatsapp:${phoneNumber}`
  const fromNumber = `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`

  let twilioSid: string | undefined

  try {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      const twilio = await import("twilio")
      const client = twilio.default(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
      const msg = await client.messages.create({
        from: fromNumber,
        to: toNumber,
        body,
        ...(mediaUrl ? { mediaUrl: [mediaUrl] } : {}),
      })
      twilioSid = msg.sid
    }
  } catch (err) {
    console.error("WhatsApp send error:", err)
  }

  const message = await prisma.whatsAppMessage.create({
    data: {
      fromNumber,
      toNumber,
      body,
      mediaUrl,
      direction: "OUTBOUND",
      status: twilioSid ? "SENT" : "MOCK",
      twilioSid,
      contactId: contactId || undefined,
    },
  })

  if (contactId) {
    await prisma.activity.create({
      data: {
        type: "WHATSAPP_SENT",
        title: "WhatsApp message sent",
        description: body.slice(0, 100),
        contactId,
        userId: session?.user?.id as string,
      },
    })
  }

  return NextResponse.json(message)
}
