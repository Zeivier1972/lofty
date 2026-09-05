export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { chatWithAI } from "@/lib/ai-agent"
import { sendWhatsApp } from "@/lib/sms"
import { handleLeadEngaged, notifyAgentOfLeadReply } from "@/lib/lead-flow"
import { extractBuyerPrefsFromNote, triggerMatchAlert, buildListingsReply } from "@/lib/trigger-match-alert"
import { ingestLead } from "@/lib/lead-ingest"
import { findEventByAdText, type EventInfo } from "@/lib/events"

// ---------------------------------------------------------------------------
// Sofía's first reply to someone arriving from a click-to-WhatsApp ad.
// This is the ONE message a cold ad lead sees, so keep it short, name the event,
// and end with a question — edit the copy here.
// ---------------------------------------------------------------------------
function ctwaGreeting(firstName: string, ev?: EventInfo): string {
  const hi = firstName && firstName !== "Lead" ? `¡Hola ${firstName}! 👋` : "¡Hola! 👋"
  if (!ev) {
    return `${hi} Soy Sofía, asistente de Catherine Gómez Realtor. Gracias por escribirnos — te ayudo a invertir en Miami desde Colombia. ¿Qué te gustaría saber?`
  }
  const venue = ev.venue ? ` en ${ev.venue}` : ""
  return `${hi} Soy Sofía, asistente de Catherine Gómez Realtor. Gracias por tu interés en nuestro Evento de Inversión en Miami en ${ev.city} — ${ev.dateLabel}${venue}. La entrada es GRATIS pero los cupos son limitados. 🎟️ Asegura tu lugar aquí: ${ev.link}\n\n¿Te aparto un cupo?`
}

export async function POST(req: Request) {
  const formData = await req.formData()
  const from = formData.get("From") as string
  const body = formData.get("Body") as string
  const mediaUrl = formData.get("MediaUrl0") as string | null

  // Meta forwards these only when the message came from a click-to-WhatsApp ad.
  // ReferralSourceId (the ad) present == this is an ad lead, not an organic message.
  const referralSourceId = formData.get("ReferralSourceId") as string | null
  const referralHeadline = formData.get("ReferralHeadline") as string | null
  const referralBody = formData.get("ReferralBody") as string | null
  const referralCtwaClid = formData.get("ReferralCtwaClid") as string | null
  const profileName = (formData.get("ProfileName") as string | null) || ""

  if (!from || !body) return new NextResponse("", { status: 200 })

  const phone = from.replace("whatsapp:", "").replace(/\D/g, "")
  let contact = await prisma.contact.findFirst({
    where: {
      OR: [
        { phone: { contains: phone.slice(-10) } },
        { phone2: { contains: phone.slice(-10) } },
      ],
    },
  })

  // A click-to-WhatsApp lead is by definition a number we have never seen. Without
  // this, the handler below (all gated on `contact`) would return silence: no reply,
  // no tag, no notification — the lead taps the ad and never hears back.
  // Reuse the normal lead pipeline so they get the same tags, smart-plan enrollment,
  // event-sheet sync and alert as a form lead; skipOutreach stops the outbound
  // SMS/email/call welcome, because Sofía answers in this thread instead.
  let ctwaEvent: EventInfo | undefined
  let isNewCtwaLead = false
  if (!contact && referralSourceId) {
    ctwaEvent = findEventByAdText(referralHeadline, referralBody)
    const nameParts = profileName.trim().split(/\s+/).filter(Boolean)
    try {
      const { contactId } = await ingestLead({
        firstName: nameParts[0] || "Lead",
        lastName: nameParts.slice(1).join(" ") || undefined,
        phone: from.replace("whatsapp:", ""),   // keep E.164 so +57 is preserved
        source: "FACEBOOK_CTWA",
        campaign: referralHeadline || undefined,
        message: body,
        notes: [
          "Lead de anuncio click-to-WhatsApp",
          referralHeadline ? `Anuncio: ${referralHeadline}` : null,
          `ad_id: ${referralSourceId}`,
          referralCtwaClid ? `ctwa_clid: ${referralCtwaClid}` : null,
        ].filter(Boolean).join(" · "),
        tags: ctwaEvent ? [ctwaEvent.tag] : [],
        skipOutreach: true,
      })
      contact = await prisma.contact.findUnique({ where: { id: contactId } })
      isNewCtwaLead = true
      console.log(`[CTWA] New WhatsApp ad lead ${from} → contact ${contactId}${ctwaEvent ? ` (${ctwaEvent.city})` : ""}`)
    } catch (e) {
      console.error("[CTWA] Failed to create contact for ad lead:", e)
    }
  }

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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"

    // First message from a click-to-WhatsApp ad lead: answer with the event greeting
    // rather than a generic AI reply, so they immediately see which event they
    // reached and the ticket link. It is stored in the conversation history below,
    // so Sofía has that context for every following message.
    let reply: string | null = isNewCtwaLead ? ctwaGreeting(contact.firstName, ctwaEvent) : null
    const prefs = reply ? null : await extractBuyerPrefsFromNote(body).catch(() => null)
    const hasCriteria = prefs && (prefs.buyerLocation || prefs.buyerBudgetMax || prefs.buyerBedroomsMin)
    if (hasCriteria) {
      const data: Record<string, any> = {}
      for (const [k, v] of Object.entries(prefs!)) {
        if (v !== null && v !== undefined && v !== "") data[k] = v
      }
      data.matchPrefsCompletedAt = new Date()
      await prisma.contact.update({ where: { id: contact.id }, data }).catch(() => {})
      reply = await buildListingsReply({ ...contact, ...data }, appUrl)
      if (contact.email) triggerMatchAlert(contact.id).catch(() => {})
    }

    if (!reply) {
      const messages = history.map(m => ({ role: m.role as "user" | "assistant", content: m.content }))
      const contactCtx = `Contact: ${contact.firstName} ${contact.lastName}. Responding via WhatsApp.`
      reply = await chatWithAI(messages, contactCtx)
    }

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

    // Notify Catherine directly by SMS + email
    notifyAgentOfLeadReply(contact, "WhatsApp", body).catch(() => {})
  }

  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
    { headers: { "Content-Type": "application/xml" } }
  )
}
