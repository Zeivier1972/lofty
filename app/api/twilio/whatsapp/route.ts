export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { chatWithAI } from "@/lib/ai-agent"
import { sendWhatsApp } from "@/lib/sms"
import { handleLeadEngaged } from "@/lib/lead-flow"

export async function POST(req: Request) {
  const formData = await req.formData()
  const from = formData.get("From") as string
  const body = formData.get("Body") as string
  const mediaUrl = formData.get("MediaUrl0") as string | null

  if (!from || !body) return new NextResponse("", { status: 200 })

  const phone = from.replace("whatsapp:", "").replace(/\D/g, "")
  const contact = await prisma.contact.findFirst({
    where: {
      OR: [
        { phone: { contains: phone.slice(-10) } },
        { phone2: { contains: phone.slice(-10) } },
      ],
    },
  })

  await prisma.whatsAppMessage.create({
    data: {
      fromNumber: from,
      toNumber: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
      body,
      mediaUrl,
      direction: "INBOUND",
      status: "RECEIVED",
      contactId: contact?.id,
    },
  })

  // Log inbound WhatsApp as activity
  if (contact) {
    prisma.activity.create({
      data: { type: "WHATSAPP", title: "Inbound WhatsApp from contact", description: body.slice(0, 200), contactId: contact.id },
    }).catch(() => {})
  }

  if (contact) {
    let conversation = await prisma.aIConversation.findFirst({ where: { contactId: contact.id } })
    if (!conversation) {
      conversation = await prisma.aIConversation.create({ data: { contactId: contact.id, status: "ACTIVE" } })
    }

    await prisma.aIMessage.create({ data: { conversationId: conversation.id, role: "user", content: body } })

    const history = await prisma.aIMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
      take: 10,
    })

    const messages = history.map(m => ({ role: m.role as "user" | "assistant", content: m.content }))
    const contactCtx = `Contact: ${contact.firstName} ${contact.lastName}. Responding via WhatsApp.`
    const reply = await chatWithAI(messages, contactCtx)

    await prisma.aIMessage.create({ data: { conversationId: conversation.id, role: "assistant", content: reply } })

    await sendWhatsApp(from, reply)

    await prisma.whatsAppMessage.create({
      data: {
        fromNumber: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
        toNumber: from,
        body: reply,
        direction: "OUTBOUND",
        status: "SENT",
        contactId: contact.id,
      },
    })

    // Log Sofía's outbound reply as activity
    prisma.activity.create({
      data: { type: "WHATSAPP", title: "Sofía replied via WhatsApp", description: reply.slice(0, 200), contactId: contact.id },
    }).catch(() => {})

    // Move to Warm pipeline, pause drip enrollments, notify Catherine
    handleLeadEngaged(contact.id, "WhatsApp", body).catch(() => {})
  }

  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
    { headers: { "Content-Type": "application/xml" } }
  )
}
