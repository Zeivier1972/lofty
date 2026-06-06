export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { chatWithAI } from "@/lib/ai-agent"
import { sendSMS } from "@/lib/sms"

export async function POST(req: Request) {
  const formData = await req.formData()
  const from = formData.get("From") as string
  const body = formData.get("Body") as string
  const messageSid = formData.get("MessageSid") as string

  if (!from || !body) {
    return new NextResponse("", { status: 200 })
  }

  // Normalize phone number
  const phone = from.replace(/\D/g, "")

  // Find contact by phone
  const contact = await prisma.contact.findFirst({
    where: {
      OR: [
        { phone: { contains: phone.slice(-10) } },
        { phone2: { contains: phone.slice(-10) } },
      ],
    },
  })

  // Store inbound SMS
  await prisma.sMSMessage.create({
    data: {
      toNumber: process.env.TWILIO_PHONE_NUMBER || "",
      fromNumber: from,
      body,
      direction: "INBOUND",
      status: "RECEIVED",
      contactId: contact?.id,
    },
  })

  // Log conversation in AI system
  if (contact) {
    let conversation = await prisma.aIConversation.findFirst({
      where: { contactId: contact.id },
    })

    if (!conversation) {
      conversation = await prisma.aIConversation.create({
        data: { contactId: contact.id, status: "ACTIVE" },
      })
    }

    await prisma.aIMessage.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: body,
      },
    })

    // Get recent conversation messages for context
    const history = await prisma.aIMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
      take: 10,
    })

    // Generate AI reply
    const messages = history.map(m => ({ role: m.role as "user" | "assistant", content: m.content }))
    const contactCtx = `Contact: ${contact.firstName} ${contact.lastName}, Status: ${contact.status}, Score: ${contact.leadScore}`
    const reply = await chatWithAI(messages, contactCtx)

    // Save AI reply
    await prisma.aIMessage.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: reply,
      },
    })

    // Send reply via SMS
    await sendSMS(from, reply)

    // Store outbound
    await prisma.sMSMessage.create({
      data: {
        toNumber: from,
        fromNumber: process.env.TWILIO_PHONE_NUMBER || "",
        body: reply,
        direction: "OUTBOUND",
        status: "SENT",
        contactId: contact.id,
      },
    })

    // Notify Catherine
    await prisma.aINotification.create({
      data: {
        type: "MESSAGE_RECEIVED",
        title: `Reply from ${contact.firstName} ${contact.lastName}`,
        body: `"${body.slice(0, 100)}${body.length > 100 ? "..." : ""}"`,
        priority: "MEDIUM",
        contactId: contact.id,
      },
    })
  }

  // Twilio expects 200 with empty TwiML or just 200
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
    { headers: { "Content-Type": "application/xml" } }
  )
}
