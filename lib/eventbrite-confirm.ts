import { prisma } from "@/lib/prisma"
import { ingestLead, applyTagAndEnroll } from "@/lib/lead-ingest"

// Shared "ticket confirmed" logic used by BOTH the Zapier/Make webhook
// (/api/leads/eventbrite) and the native Eventbrite webhook
// (/api/webhooks/eventbrite). When someone gets their ticket we:
//   1. find the existing lead (they filled the Facebook form first),
//   2. tag them "Ticket: <event>" (marks them confirmed / going),
//   3. STOP the "get your ticket" Smart Plan chase for that event,
//   4. or create a fresh contact if they registered on Eventbrite directly.

export interface TicketConfirmation {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  eventName?: string   // human-readable event name (for the tag + timeline)
  eventTag?: string    // the utm_content tag whose chase-plan should stop
}

export interface TicketResult {
  contactId: string | null
  confirmedTag: string
  stoppedChase: number
  reason?: string
}

export async function confirmEventbriteTicket(t: TicketConfirmation): Promise<TicketResult> {
  const email = t.email?.trim() || undefined
  const phoneRaw = t.phone?.trim() || undefined
  const phoneDigits = phoneRaw ? phoneRaw.replace(/\D/g, "").slice(-10) : null
  if (!email && !phoneDigits) {
    return { contactId: null, confirmedTag: "", stoppedChase: 0, reason: "no email or phone" }
  }

  const firstName = t.firstName?.trim().split(" ")[0] || "Invitado"
  const lastName = t.lastName?.trim() || undefined
  const eventName = t.eventName?.trim() || undefined
  const eventTag = t.eventTag?.trim() || undefined
  const confirmedTag = eventName ? `Ticket: ${eventName}` : (eventTag ? `Ticket: ${eventTag}` : "Ticket confirmado")

  // Find the existing lead (case-insensitive email, else last-10-digits phone).
  const existing = email
    ? await prisma.contact.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } })
    : phoneDigits
      ? await prisma.contact.findFirst({ where: { phone: { contains: phoneDigits } }, select: { id: true } })
      : null

  let contactId: string
  if (existing) {
    contactId = existing.id
    await applyTagAndEnroll(contactId, confirmedTag) // marks confirmed + can trigger a reminders plan
    await prisma.activity.create({
      data: { type: "OTHER", title: `🎟️ Ticket confirmado${eventName ? `: ${eventName}` : ""}`, description: "Registró su ticket en Eventbrite", contactId },
    }).catch(() => {})
  } else {
    // New person who registered on Eventbrite directly (no prior Facebook lead).
    const tags = [confirmedTag]
    if (eventTag) tags.push(eventTag)
    const r = await ingestLead({
      firstName, lastName, email, phone: phoneRaw, source: "EVENTBRITE",
      campaign: eventName || "Eventbrite",
      message: `Registró su ticket en Eventbrite${eventName ? `: ${eventName}` : ""}`,
      smsConsent: !!phoneRaw, tags,
    })
    contactId = r.contactId
  }

  // Stop the "get your ticket" chase: complete active enrollments in any plan
  // triggered by the event tag (they already have their ticket).
  let stoppedChase = 0
  if (eventTag) {
    const tag = await prisma.tag.findFirst({ where: { name: { equals: eventTag, mode: "insensitive" } }, select: { id: true } })
    if (tag) {
      const plans = await prisma.smartPlan.findMany({ where: { trigger: `CONTACT_TAGGED:${tag.id}` }, select: { id: true } })
      if (plans.length) {
        const res = await prisma.smartPlanEnrollment.updateMany({
          where: { contactId, planId: { in: plans.map(p => p.id) }, status: "ACTIVE" },
          data: { status: "COMPLETED", completedAt: new Date() },
        })
        stoppedChase = res.count
      }
    }
  }

  return { contactId, confirmedTag, stoppedChase }
}
