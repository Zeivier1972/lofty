export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendSMS } from "@/lib/sms"
import { sendEmail, wrapEmail } from "@/lib/email"

// Daily: Sofía follows up with HOT BUYERS (3+ saves/views) — one short, personal
// nudge that offers more homes and drives to a call/appointment with Catherine.
// Cost-controlled: once per lead per 3 days, capped per run, SMS goes through the
// automated path (kill switch + monthly cap + cooldown + GSM-7 = one cheap
// segment); email is the fallback when there's no phone. Prefers SMS (higher
// response) but the monthly cap keeps spend bounded.

const PER_RUN_CAP = 25         // don't blast — a handful of the hottest per day
const COOLDOWN_DAYS = 3        // never follow up the same lead more than once / 3 days
const MIN_INTERACTIONS = 3     // "hot" threshold, matches the dashboard

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET || process.env.MLS_SYNC_SECRET
  const header = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "")
  if (secret && header !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // 1. Rank hot buyers by saves + views.
  const [saves, views] = await Promise.all([
    prisma.propertySave.groupBy({ by: ["contactId"], where: { isActive: true }, _count: { _all: true } }),
    prisma.propertyView.groupBy({ by: ["contactId"], where: { contactId: { not: null } }, _count: { _all: true } }),
  ])
  const score = new Map<string, number>()
  for (const r of [...saves, ...views] as any[]) {
    const id = r.contactId
    if (!id) continue
    score.set(id, (score.get(id) || 0) + r._count._all)
  }
  const hotIds = Array.from(score.entries())
    .filter(([, n]) => n >= MIN_INTERACTIONS)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
  if (!hotIds.length) return NextResponse.json({ ok: true, followedUp: 0, reason: "no hot buyers" })

  // 2. Skip anyone already nudged in the last COOLDOWN_DAYS.
  const since = new Date(Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000)
  const recent = await prisma.activity.findMany({
    where: { type: "HOT_BUYER_FOLLOWUP", contactId: { in: hotIds }, createdAt: { gte: since } },
    select: { contactId: true },
  }).catch(() => [])
  const recentSet = new Set(recent.map(r => r.contactId))

  const contacts = await prisma.contact.findMany({
    where: { id: { in: hotIds.filter(id => !recentSet.has(id)) } },
    select: { id: true, firstName: true, phone: true, email: true, doNotText: true, doNotEmail: true, buyerLocation: true },
  })
  // Preserve hotness order, then cap.
  const ordered = hotIds.map(id => contacts.find(c => c.id === id)).filter(Boolean).slice(0, PER_RUN_CAP) as typeof contacts

  const cfg = await prisma.aIConfig.findFirst({ select: { realtorName: true, realtorPhone: true, realtorEmail: true, calendlyUrl: true } }).catch(() => null)
  const agentName = cfg?.realtorName || "Catherine"
  const agentPhone = cfg?.realtorPhone || "305-283-0872"
  const bookUrl = (cfg as any)?.calendlyUrl || `${process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"}/book`

  let sms = 0, email = 0
  for (const c of ordered) {
    const first = c.firstName || ""
    const area = c.buyerLocation ? ` en ${String(c.buyerLocation).split(",")[0]}` : ""
    let sent = false

    if (c.phone && !c.doNotText) {
      // Short, personal, drives to a call. Sanitized to one cheap segment.
      const body = `Hola ${first}, soy Sofia de ${agentName} Gomez Realtor. Vi que has estado viendo propiedades${area}. Quieres que te mande mas opciones, o agendamos una llamada rapida con ${agentName}? ${bookUrl}`
      const sid = await sendSMS(c.phone, body, undefined, { automated: true, contactId: c.id }).catch(() => null)
      if (sid) { sms++; sent = true }
    }
    if (!sent && c.email && !c.doNotEmail) {
      const html = wrapEmail(`
        <p style="color:#374151;font-size:15px;margin:0 0 12px">¡Hola ${first}! 👋</p>
        <p style="color:#374151;font-size:14px;margin:0 0 16px">
          Soy Sofía, asistente de ${agentName} Gomez Realtor. Vi que has estado mirando propiedades${area} — ¡me encanta!
          ¿Quieres que te envíe algunas opciones más que se ajusten a lo que buscas? Mejor aún, agenda una llamada rápida con ${agentName} y armamos tu estrategia:
        </p>
        <a href="${bookUrl}" style="background:#c9a84c;color:#0a0e1a;padding:13px 26px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;margin:0 0 16px">Agendar una llamada con ${agentName} →</a>
        <p style="color:#6b7280;font-size:14px;margin:0">O responde a este correo y con gusto te ayudo. 📞 ${agentPhone}</p>
      `, { agentName, agentPhone, agentEmail: cfg?.realtorEmail || "" })
      const ok = await sendEmail({ to: c.email, transactional: true, subject: `¿Seguimos con tu búsqueda${area}? — ${agentName} Gomez Realtor`, html }).catch(() => false)
      if (ok) { email++; sent = true }
    }

    if (sent) {
      await prisma.activity.create({
        data: { type: "HOT_BUYER_FOLLOWUP", title: "Sofía dio seguimiento a comprador caliente", description: `Invitó a agendar con ${agentName}`, contactId: c.id },
      }).catch(() => {})
    }
  }

  console.log(`[hot-buyer-followup] SMS=${sms} email=${email} of ${ordered.length} candidates`)
  return NextResponse.json({ ok: true, sms, email, candidates: ordered.length })
}
