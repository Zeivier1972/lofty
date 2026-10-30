export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendEmail, wrapEmail } from "@/lib/email"
import { computeBuyerIntent } from "@/lib/buyer-intent"
import { AGENT_TZ, easternWallTime } from "@/lib/eastern-time"

// Every morning (~7:30 ET): Sofía's briefing for Catherine — one email that
// says who to call today and why, in priority order:
//   1. today's appointments,
//   2. buy-now leads without an appointment (reasons + an opener),
//   3. who replied in the last 24h,
//   4. new leads from the last 24h.
// The point is that Catherine opens one email and knows her calls for the day.

const MAX_HOT = 15

const esc = (s: string) => s.replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch] as string))
const time = (d: Date) => d.toLocaleTimeString("es-US", { timeZone: AGENT_TZ, hour: "numeric", minute: "2-digit" })

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET || process.env.MLS_SYNC_SECRET
  const header = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "")
  if (secret && header !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const cfg = await prisma.aIConfig.findFirst({ select: { realtorEmail: true, realtorName: true } }).catch(() => null)
  if (!cfg?.realtorEmail) return NextResponse.json({ ok: false, reason: "no realtorEmail in AI settings" })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.catherinegomezrealtor.com"
  const now = new Date()
  const todayEt = now.toLocaleDateString("en-CA", { timeZone: AGENT_TZ })
  const dayStart = easternWallTime(todayEt, "00:00")
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000)
  const since24h = new Date(now.getTime() - 24 * 3600 * 1000)

  const [appts, intent, sms, wa, fb, mail, newLeads] = await Promise.all([
    prisma.appointment.findMany({
      where: { status: { not: "CANCELLED" }, startTime: { gte: dayStart, lt: dayEnd } },
      orderBy: { startTime: "asc" },
      select: { startTime: true, title: true, location: true, contact: { select: { id: true, firstName: true, lastName: true, phone: true } } },
    }),
    computeBuyerIntent(now),
    prisma.sMSMessage.findMany({ where: { direction: "INBOUND", createdAt: { gte: since24h }, contactId: { not: null } }, select: { contactId: true, body: true, createdAt: true } }),
    prisma.whatsAppMessage.findMany({ where: { direction: "INBOUND", createdAt: { gte: since24h }, contactId: { not: null } }, select: { contactId: true, body: true, createdAt: true } }),
    prisma.facebookMessage.findMany({ where: { direction: "INBOUND", createdAt: { gte: since24h }, contactId: { not: null } }, select: { contactId: true, body: true, createdAt: true } }),
    prisma.email.findMany({ where: { direction: "INBOUND", createdAt: { gte: since24h }, contactId: { not: null } }, select: { contactId: true, subject: true, createdAt: true } }),
    prisma.contact.findMany({
      where: { createdAt: { gte: since24h }, isArchived: false },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { id: true, firstName: true, lastName: true, phone: true, source: true },
    }),
  ])

  const hot = intent.filter(l => l.level === "HOT" && !l.upcomingAppointment).slice(0, MAX_HOT)
  const warmCount = intent.filter(l => l.level === "WARM").length

  // Latest reply per person, across channels.
  const replies = new Map<string, { channel: string; text: string; at: Date }>()
  const add = (rows: { contactId: string | null; createdAt: Date }[], channel: string, text: (r: any) => string) => {
    for (const r of rows) {
      const prev = replies.get(r.contactId!)
      if (!prev || prev.at < r.createdAt) replies.set(r.contactId!, { channel, text: text(r), at: r.createdAt })
    }
  }
  add(sms, "SMS", r => r.body)
  add(wa, "WhatsApp", r => r.body)
  add(fb, "Messenger/IG", r => r.body)
  add(mail, "Email", r => r.subject)
  const replyContacts = replies.size
    ? await prisma.contact.findMany({ where: { id: { in: Array.from(replies.keys()) } }, select: { id: true, firstName: true, lastName: true, phone: true } })
    : []

  const link = (id: string, name: string) => `<a href="${appUrl}/contacts/${id}" style="color:#0e1f3d;font-weight:700;text-decoration:none">${esc(name)}</a>`
  const tel = (p: string | null) => p ? ` · <a href="tel:${p}" style="color:#2563eb">${esc(p)}</a>` : ""
  const section = (title: string, body: string) =>
    `<h3 style="color:#0e1f3d;font-size:16px;margin:24px 0 8px;border-bottom:2px solid #c9a84c;padding-bottom:4px">${title}</h3>${body}`
  const empty = (t: string) => `<p style="color:#9ca3af;font-size:13px;margin:0">${t}</p>`

  const apptHtml = appts.length
    ? appts.map(a => `<p style="margin:0 0 6px;font-size:14px"><strong>${time(a.startTime)}</strong> — ${a.contact ? link(a.contact.id, `${a.contact.firstName} ${a.contact.lastName || ""}`) : esc(a.title)}${tel(a.contact?.phone || null)}${a.location ? ` <span style="color:#6b7280">(${esc(a.location)})</span>` : ""}</p>`).join("")
    : empty("No hay citas hoy.")

  const hotHtml = hot.length
    ? hot.map((l, i) => `
      <div style="margin:0 0 12px;padding:10px 12px;background:#fff7ed;border-left:4px solid #f97316;border-radius:6px">
        <p style="margin:0 0 4px;font-size:14px">${i + 1}. ${link(l.contactId, `${l.firstName} ${l.lastName || ""}`)}${tel(l.canCall ? l.phone : null)} <span style="color:#9a3412;font-size:12px">· ${l.points} pts</span></p>
        <p style="margin:0 0 4px;font-size:13px;color:#374151">Por qué: ${esc(l.reasons.join(", "))}</p>
        <p style="margin:0;font-size:13px;color:#6b7280;font-style:italic">Para abrir: "Hola ${esc(l.firstName)}, vi que estás mirando ${esc(l.hook)}. ¿Qué es lo que más te gustó? ¿Te ayudo a verlas esta semana?"</p>
      </div>`).join("")
    : empty("Nadie con señales fuertes de compra hoy.")

  const replyHtml = replyContacts.length
    ? replyContacts
        .sort((a, b) => replies.get(b.id)!.at.getTime() - replies.get(a.id)!.at.getTime())
        .map(c => {
          const r = replies.get(c.id)!
          return `<p style="margin:0 0 6px;font-size:14px">${link(c.id, `${c.firstName} ${c.lastName || ""}`)}${tel(c.phone)} <span style="color:#6b7280">por ${r.channel}:</span> "${esc(r.text.slice(0, 120))}"</p>`
        }).join("")
    : empty("Nadie respondió en las últimas 24 horas.")

  const newHtml = newLeads.length
    ? newLeads.map(c => `<p style="margin:0 0 6px;font-size:14px">${link(c.id, `${c.firstName} ${c.lastName || ""}`)}${tel(c.phone)} <span style="color:#6b7280">· ${esc(c.source || "")}</span></p>`).join("")
    : empty("No entraron leads nuevos.")

  const first = (cfg.realtorName || "Catherine").split(" ")[0]
  const html = wrapEmail(`
    <p style="color:#374151;font-size:15px;margin:0 0 8px">Buenos días ${esc(first)} ☀️</p>
    <p style="color:#374151;font-size:14px;margin:0">Hoy tienes <strong>${appts.length}</strong> ${appts.length === 1 ? "cita" : "citas"} y <strong>${hot.length}</strong> ${hot.length === 1 ? "persona lista" : "personas listas"} para comprar que aún no agendan. ${warmCount ? `Además, ${warmCount} leads tibios que sigo trabajando.` : ""}</p>
    ${section("📅 Citas de hoy", apptHtml)}
    ${section("🔥 Llámales hoy — listos para comprar", hotHtml)}
    ${section("💬 Respondieron (24 h)", replyHtml)}
    ${section("🆕 Leads nuevos (24 h)", newHtml)}
    <p style="color:#6b7280;font-size:12px;margin:24px 0 0">A los leads calientes ya les escribí invitándolos a una llamada contigo, y sus tareas de llamada están en tu lista. — Sofía</p>
  `, { agentName: cfg.realtorName || "Catherine" })

  const ok = await sendEmail({
    to: cfg.realtorEmail,
    transactional: true,
    subject: `☀️ Tu día: ${hot.length} para llamar, ${appts.length} ${appts.length === 1 ? "cita" : "citas"}, ${replyContacts.length} respuestas`,
    html,
  }).catch(() => false)

  await prisma.aINotification.create({
    data: {
      type: "DAILY_BRIEFING",
      title: `☀️ Briefing de hoy: ${hot.length} listos para comprar`,
      body: hot.length ? `Llamar primero: ${hot.slice(0, 5).map(h => h.firstName).join(", ")}` : "Revisa tu correo para el resumen del día.",
      priority: hot.length ? "HIGH" : "MEDIUM",
    },
  }).catch(() => {})

  return NextResponse.json({ ok, appointments: appts.length, hot: hot.length, warm: warmCount, replies: replyContacts.length, newLeads: newLeads.length })
}
