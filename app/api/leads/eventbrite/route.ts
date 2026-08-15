export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ingestLead, applyTagAndEnroll } from "@/lib/lead-ingest"

// Eventbrite → CASAi: a TICKET CONFIRMATION. When someone gets their ticket
// (via Zapier "New Attendee" → this webhook), we mark them confirmed and STOP
// the "get your ticket" Smart Plan chase for that event. Pass `tag` = the event
// tag (the same utm_content tag the Facebook form applied, e.g.
// "Evento Medellin Septiembre 2026"), so we can find & stop the matching plan.
function reader(body: Record<string, any>) {
  return (...keys: string[]) => {
    for (const k of keys) {
      const v = body[k] ?? body[k.toLowerCase()] ?? body[k.toUpperCase()]
      if (v != null && String(v).trim()) return String(v).trim()
    }
    return undefined
  }
}

export async function POST(req: Request) {
  const secret = process.env.ZAPIER_SECRET
  if (secret) {
    const provided = req.headers.get("x-zapier-secret") || new URL(req.url).searchParams.get("secret")
    if (provided !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    let body: Record<string, any> = {}
    const ct = req.headers.get("content-type") || ""
    if (ct.includes("application/json")) body = await req.json()
    else {
      const text = await req.text()
      try { body = JSON.parse(text) } catch { const p = new URLSearchParams(text); p.forEach((v, k) => { body[k] = v }) }
    }

    const get = reader(body)
    const rawName = get("name", "full_name", "attendee_name", "firstName", "first_name") || ""
    const firstName = get("firstName", "first_name", "firstname")?.split(" ")[0] || rawName.split(" ")[0] || "Invitado"
    const lastName = get("lastName", "last_name", "lastname") || (rawName.includes(" ") ? rawName.split(" ").slice(1).join(" ") : undefined)
    const email = get("email", "email_address", "Email")
    const phoneRaw = get("phone", "cell_phone", "phone_number", "mobile", "cell", "Phone")
    const phoneDigits = phoneRaw ? phoneRaw.replace(/\D/g, "").slice(-10) : null
    if (!email && !phoneDigits) return NextResponse.json({ error: "email or phone required" }, { status: 400 })

    const eventName = get("event_name", "event", "eventName", "event_title", "title")
    const eventTag = get("tag", "event_tag", "tags")   // the event tag whose chase-plan should stop
    const confirmedTag = eventName ? `Ticket: ${eventName}` : (eventTag ? `Ticket: ${eventTag}` : "Ticket confirmado")

    // Find the existing lead (they filled the FB form first). Don't re-run the
    // full welcome for someone we already have — just confirm + stop the chase.
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
      // New person who registered on Eventbrite directly (no prior FB lead).
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
      const t = await prisma.tag.findFirst({ where: { name: { equals: eventTag, mode: "insensitive" } }, select: { id: true } })
      if (t) {
        const plans = await prisma.smartPlan.findMany({ where: { trigger: `CONTACT_TAGGED:${t.id}` }, select: { id: true } })
        if (plans.length) {
          const res = await prisma.smartPlanEnrollment.updateMany({
            where: { contactId, planId: { in: plans.map(p => p.id) }, status: "ACTIVE" },
            data: { status: "COMPLETED", completedAt: new Date() },
          })
          stoppedChase = res.count
        }
      }
    }

    return NextResponse.json({ ok: true, contactId, confirmedTag, stoppedChase })
  } catch (e) {
    console.error("[eventbrite confirm]", e)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
