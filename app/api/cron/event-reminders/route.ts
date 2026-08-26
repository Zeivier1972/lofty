export const dynamic = "force-dynamic"
export const maxDuration = 60

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendSMS, toE164 } from "@/lib/sms"
import { sendEmail } from "@/lib/email"
import { EVENTS } from "@/lib/events"

// Date-ANCHORED event reminders. Runs daily; for each event, when it is exactly
// 7 / 3 / 1 / 0 days away it sends a countdown reminder (email + SMS) to everyone
// tagged for that event — with one-click "Sí, asistiré / No podré" RSVP buttons
// so people who don't answer Catherine's call can still confirm. Deduped per
// contact/day, and anyone who already RSVP'd "no" is left alone.

const ANCHORS = [7, 3, 1, 0]

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const header = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "")
  const param = new URL(req.url).searchParams.get("secret")
  return header === secret || param === secret
}

function daysUntil(isoDate: string): number {
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
  const today = new Date(`${todayStr}T00:00:00Z`).getTime()
  const event = new Date(`${isoDate}T00:00:00Z`).getTime()
  return Math.round((event - today) / 86400000)
}

function whenPhrase(d: number): string {
  return d === 7 ? "En 1 semana" : d === 3 ? "En 3 días" : d === 1 ? "Mañana" : "HOY"
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const base = process.env.NEXT_PUBLIC_APP_URL || "https://www.catherinegomezrealtor.com"
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
    const venueLine = ev.venue ? ` en ${ev.venue}` : ""
    let sent = 0

    for (const { contact: c } of links) {
      if (!c) continue

      // Already reminded for this event at this milestone?
      const already = await prisma.activity.findFirst({ where: { contactId: c.id, type: "EVENT_REMINDER", description: { contains: marker } } })
      if (already) continue

      // Respect a "No podré" RSVP — don't keep reminding someone who declined.
      const declined = await prisma.activity.findFirst({ where: { contactId: c.id, type: "EVENT_RSVP", description: { contains: `rsvp:${ev.tag}:no` } } })
      if (declined) continue

      const ticketed = (c.tags || []).some(t => /^ticket:/i.test(t.tag?.name || ""))
      const first = (c.firstName || "").split(" ")[0]
      const rsvpBase = `${base}/api/rsvp?c=${encodeURIComponent(c.id)}&ev=${encodeURIComponent(ev.tag)}`

      // SMS — short, with a single RSVP link (leads to Sí/No buttons)
      const sms = ticketed
        ? `${first} 🎉 ${when === "HOY" ? "¡HOY" : when === "Mañana" ? "¡Mañana" : `¡${when.toLowerCase()}`} es el Evento de Inversión en Miami en ${ev.city}! (${ev.dateLabel})${venueLine}. Confirma tu asistencia 👉 ${rsvpBase}`
        : `${first} 🎉 ${when} es el Evento de Inversión en Miami en ${ev.city} (${ev.dateLabel}). Asegura tu lugar GRATIS: ${ev.link} · ¿Asistirás? 👉 ${rsvpBase}`

      const rsvpButtons = `<div style="margin:22px 0"><p style="color:#1E3A5F;font-weight:bold;margin:0 0 10px">¿Nos acompañas?</p><a href="${rsvpBase}&a=yes" style="background:#059669;color:#fff;padding:13px 26px;border-radius:50px;text-decoration:none;font-weight:bold;display:inline-block;margin:4px">✅ Sí, asistiré</a><a href="${rsvpBase}&a=no" style="background:#e5e7eb;color:#374151;padding:13px 26px;border-radius:50px;text-decoration:none;font-weight:bold;display:inline-block;margin:4px">No podré</a></div>`

      const emailHtml = ticketed
        ? `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#1E3A5F">${first}, ${when.toLowerCase()} nos vemos en ${ev.city} 🎉</h2><p style="color:#555;line-height:1.6">El <strong>${ev.dateLabel}</strong>${venueLine} vas a descubrir, paso a paso, cómo invertir en Miami desde Colombia. ¡Prepárate!</p>${rsvpButtons}<p style="color:#777;font-size:13px">Ya tienes tu ticket — solo confírmanos que asistirás. 🚀</p></div>`
        : `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#1E3A5F">${first}, ${when.toLowerCase()} es el evento en ${ev.city} 🎉</h2><p style="color:#555;line-height:1.6">El <strong>${ev.dateLabel}</strong> te mostramos cómo invertir en Miami desde Colombia. Los cupos son limitados.</p><p style="text-align:center;margin:22px 0"><a href="${ev.link}" style="background:#1E3A5F;color:#C9A84C;padding:14px 30px;border-radius:50px;text-decoration:none;font-weight:bold;display:inline-block">🎟️ Asegurar mi lugar gratis</a></p>${rsvpButtons}</div>`

      let didSend = false
      if (c.phone) {
        await sendSMS(toE164(c.phone), sms, undefined, { contactId: c.id }).then(() => { didSend = true }).catch(() => {})
      }
      if (c.email) {
        await sendEmail({
          to: c.email,
          subject: `${when}: Evento de Inversión en Miami en ${ev.city} 🏙️`,
          html: emailHtml,
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
