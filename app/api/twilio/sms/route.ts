export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { chatWithAI } from "@/lib/ai-agent"
import { sendSMS } from "@/lib/sms"
import { scoreContact } from "@/lib/scoring"
import { handleLeadEngaged, notifyAgentOfLeadReply } from "@/lib/lead-flow"
import { detectKeyword, deliverLeadMagnet } from "@/lib/lead-magnet-delivery"
import { extractBuyerPrefsFromNote, triggerMatchAlert } from "@/lib/trigger-match-alert"

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

  // Log inbound SMS as activity
  if (contact) {
    prisma.activity.create({
      data: { type: "SMS", title: "Inbound SMS from contact", description: body.slice(0, 200), contactId: contact.id },
    }).catch(() => {})
  }

  // ── Lead magnet keyword detection ─────────────────────────────────────────
  const keyword = await detectKeyword(body)
  if (keyword) {
    const deliveryContact = contact
      ? { id: contact.id, firstName: contact.firstName, phone: from, email: contact.email }
      : { firstName: "Hola", phone: from }
    await deliverLeadMagnet(keyword, deliveryContact, { sms: true, email: true, fbDm: false, igDm: false })
    return new NextResponse("", { status: 200 })
  }

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

    // Log Sofía's outbound reply as activity
    prisma.activity.create({
      data: { type: "SMS", title: "Sofía replied via SMS", description: reply.slice(0, 200), contactId: contact.id },
    }).catch(() => {})

    // Update score on inbound SMS reply
    scoreContact(contact.id).catch(() => {})

    // Move to Warm pipeline, pause drip enrollments, notify Catherine (in-app)
    handleLeadEngaged(contact.id, "SMS", body).catch(() => {})

    // Notify Catherine directly by SMS + email — she should never miss a reply
    notifyAgentOfLeadReply(contact, "SMS", body).catch(() => {})

    // If the reply reveals buyer interest (area, budget, beds, resale/precon type),
    // extract it, save it, and have Sofía send matching properties automatically.
    extractBuyerPrefsFromNote(body).then(async prefs => {
      if (!prefs) return
      const data: Record<string, any> = {}
      for (const [k, v] of Object.entries(prefs)) {
        if (v !== null && v !== undefined && v !== "") data[k] = v
      }
      if (Object.keys(data).length === 0) return
      data.matchPrefsCompletedAt = new Date()
      await prisma.contact.update({ where: { id: contact.id }, data }).catch(() => {})
      // triggerMatchAlert emails matching MLS listings; also text the lead a heads-up
      const result = await triggerMatchAlert(contact.id).catch(() => null)
      if (result?.sent && contact.email) {
        await sendSMS(from, `¡Perfecto! Te envié algunas propiedades que coinciden a tu correo (${contact.email}). Revísalo 📩`).catch(() => {})
      }
    }).catch(() => {})

    // Notify Catherine (in-app record)
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
