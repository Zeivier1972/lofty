export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { chatWithAI } from "@/lib/ai-agent"
import { sendSMS } from "@/lib/sms"
import { scoreContact } from "@/lib/scoring"
import { handleLeadEngaged, notifyAgentOfLeadReply } from "@/lib/lead-flow"
import { detectKeyword, deliverLeadMagnet } from "@/lib/lead-magnet-delivery"
import { extractBuyerPrefsFromNote, triggerMatchAlert, buildListingsReply } from "@/lib/trigger-match-alert"

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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"

    // If the message reveals buyer criteria, reply with the ACTUAL matching
    // listings (not a generic link). Save the prefs so alerts continue too.
    let reply: string | null = null
    const prefs = await extractBuyerPrefsFromNote(body).catch(() => null)
    const hasCriteria = prefs && (prefs.buyerLocation || prefs.buyerBudgetMax || prefs.buyerBedroomsMin)
    if (hasCriteria) {
      const data: Record<string, any> = {}
      for (const [k, v] of Object.entries(prefs!)) {
        if (v !== null && v !== undefined && v !== "") data[k] = v
      }
      data.matchPrefsCompletedAt = new Date()
      await prisma.contact.update({ where: { id: contact.id }, data }).catch(() => {})
      // Merge stored prefs with just-extracted ones for the search
      const merged = { ...contact, ...data }
      reply = await buildListingsReply(merged, appUrl)
      // Also email full property cards if we have an email
      if (contact.email) triggerMatchAlert(contact.id).catch(() => {})
    }

    // No criteria (or no matches) → normal conversational AI reply
    if (!reply) {
      const messages = history.map(m => ({ role: m.role as "user" | "assistant", content: m.content }))
      const contactCtx = `Contact: ${contact.firstName} ${contact.lastName}, Status: ${contact.status}, Score: ${contact.leadScore}`
      reply = await chatWithAI(messages, contactCtx)
    }

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
