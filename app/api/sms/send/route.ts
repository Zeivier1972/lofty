export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendSMS } from "@/lib/sms"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { contactId, message, mediaUrls } = await req.json()
    if (!contactId || !message?.trim()) {
      return NextResponse.json({ error: "contactId and message required" }, { status: 400 })
    }

    const contact = await prisma.contact.findUnique({ where: { id: contactId } })
    if (!contact?.phone) {
      return NextResponse.json({ error: "Contact has no phone number" }, { status: 400 })
    }

    const sid = await sendSMS(contact.phone, message.trim(), mediaUrls?.length ? mediaUrls : undefined)

    // Save to SMSMessage log
    await prisma.sMSMessage.create({
      data: {
        contactId,
        direction: "OUTBOUND",
        body: message.trim(),
        status: sid ? "SENT" : "FAILED",
        fromNumber: process.env.TWILIO_PHONE_NUMBER || "",
        toNumber: contact.phone,
      },
    })

    // Log activity
    await prisma.activity.create({
      data: {
        type: "SMS",
        title: "SMS enviado",
        description: message.trim().slice(0, 160),
        contactId,
      },
    })

    return NextResponse.json({ success: true, sid })
  } catch (e: any) {
    console.error("[SMS send] Error:", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
