export const dynamic = "force-dynamic"
export const maxDuration = 60

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendSMS, toE164 } from "@/lib/sms"
import { sendEmail } from "@/lib/email"

// Date-ANCHORED event reminders. Runs daily; for each event, when it is exactly
// 7 / 3 / 1 / 0 days away it sends a countdown reminder to everyone tagged for
// that event — an excited "see you there" for those who already have a ticket,
// and a "last chance to register" for those who don't. Deduped per contact/day
// so a lead is never reminded twice for the same milestone.

const BOGOTA_LINK = "https://www.eventbrite.com/e/1998107399018?aff=oddtdtcreator"
const MEDELLIN_LINK = "https://www.eventbrite.com/e/1998110626672?aff=oddtdtcreator"

const EVENTS = [
  { tag: "Evento Septiembre 2026 Bogota", city: "Bogotá", dateLabel: "24 y 25 de septiembre", isoDate: "2026-09-24", link: BOGOTA_LINK },
  { tag: "Evento Medellin Septiembre 2026", city: "Medellín", dateLabel: "23 de septiembre", isoDate: "2026-09-23", link: MEDELLIN_LINK },
]

const ANCHORS = [7, 3, 1, 0]

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const header = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "")
  const param = new URL(req.url).searchParams.get("secret")
  return header === secret || param === secret
}

function daysUntil(isoDate: string): number {
  // Whole-day difference in Colombia time (event is in Colombia).
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }) // YYYY-MM-DD
  const today = new Date(`${todayStr}T00:00:00Z`).getTime()
  const event = new Date(`${isoDate}T00:00:00Z`).getTime()
  return Math.round((event - today) / 86400000)
}

function whenPhrase(d: number): string {
  return d === 7 ? "En 1 semana" : d === 3 ? "En 3 días" : d === 1 ? "Mañana" : "HOY"
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const results: any[] = []

  for (const ev of EVENTS) {
    const d = daysUntil(ev.isoDate)
    if (!ANCHORS.includes(d)) { results.push({ event: ev.city, daysUntil: d, sent: 0, skipped: "not an anchor day" }); continue }

    const tag = await prisma.tag.findFirst({ where: { name: { equals: ev.tag, mode: "insensitive" } }, select: { id: true } })
    if (!tag) { results.push({ event: ev.city, daysUntil: d, sent: 0, skipped: "tag not found" }); continue }

    const links = await prisma.contactTag.findMany({
      where: { tagId: tag.id },
      select: { contact: { select: { id: true, firstName: true, phone: true, email: true, tags: { select: { tag: { select: { name: true } } } } } } },
    })

    const marker = `evt-reminder:${ev.tag}:${d}`
    const when = whenPhrase(d)
    let sent = 0

    for (const { contact: c } of links) {
      if (!c) continue
      // Dedup — already reminded for this event at this milestone?
      const done = await prisma.activity.findFirst({ where: { contactId: c.id, type: "EVENT_REMINDER", description: { contains: marker } } })
      if (done) continue

      const ticketed = (c.tags || []).some(t => /^ticket:/i.test(t.tag?.name || ""))
      const first = (c.firstName || "").split(" ")[0]

      const sms = ticketed
        ? `${first} 🎉 ${when === "HOY" ? "¡HOY" : when === "Mañana" ? "¡Mañana" : `¡${when.toLowerCase()}`} nos vemos en el Evento de Inversión en Miami en ${ev.city}! (${ev.dateLabel}). Prepárate para descubrir cómo invertir en Miami desde Colombia. 🚀`
        : `${first} 🎉 ${when} es el Evento de Inversión en Miami en ${ev.city} (${ev.dateLabel}) y aún no veo tu registro. Asegura tu lugar GRATIS: ${ev.link}`

      let didSend = false
      if (c.phone) {
        await sendSMS(toE164(c.phone), sms, undefined, { contactId: c.id }).then(() => { didSend = true }).catch(() => {})
      }
      // Un-ticketed also get a register-push email; ticketed keep it to the SMS.
      if (!ticketed && c.email) {
        await sendEmail({
          to: c.email,
          subject: `${when}: Evento de Inversión en Miami en ${ev.city} 🏙️`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#1E3A5F">${first}, ${when.toLowerCase()} es el evento en ${ev.city} 🎉</h2><p>El <strong>${ev.dateLabel}</strong> te mostramos, paso a paso, cómo invertir en Miami desde Colombia — y aún no veo tu registro. Los cupos son limitados.</p><p style="text-align:center;margin:24px 0"><a href="${ev.link}" style="background:#1E3A5F;color:#C9A84C;padding:15px 34px;border-radius:50px;text-decoration:none;font-weight:bold;display:inline-block">🎟️ Asegurar mi lugar gratis →</a></p><p>¡Nos vemos en ${ev.city}! 🚀</p></div>`,
        }).then(() => { didSend = true }).catch(() => {})
      }

      if (didSend) {
        sent++
        await prisma.activity.create({
          data: { type: "EVENT_REMINDER", title: `Recordatorio evento ${ev.city} (${when})`, description: `${marker} · ${ticketed ? "con ticket" : "sin ticket"}`, contactId: c.id },
        }).catch(() => {})
      }
    }

    results.push({ event: ev.city, daysUntil: d, tagged: links.length, sent })
  }

  return NextResponse.json({ ok: true, results })
}
