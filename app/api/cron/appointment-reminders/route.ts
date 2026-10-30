export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendSMS } from "@/lib/sms"
import { sendEmail, wrapEmail } from "@/lib/email"
import { formatEastern } from "@/lib/eastern-time"

// Every 15 min: remind leads of their call/appointment with Catherine the day
// before and an hour before. Reminders are the cheapest show-rate lever there
// is — a booked call that nobody shows up to converts nobody. Each reminder is
// recorded as an Activity so it goes out exactly once.

const WINDOWS = [
  { kind: "24H", fromMin: 23 * 60, toMin: 25 * 60 },
  { kind: "1H", fromMin: 45, toMin: 75 },
] as const

// Online bookings made before the time-zone fix were stored 4–5 hours early, so
// a reminder for one would quote the wrong hour. Only remind newer bookings.
const REMIND_BOOKED_AFTER = new Date("2026-10-30T18:00:00Z")

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET || process.env.MLS_SYNC_SECRET
  const header = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "")
  if (secret && header !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const cfg = await prisma.aIConfig.findFirst({ select: { realtorName: true, realtorPhone: true, realtorEmail: true, zoomLink: true } }).catch(() => null)
  const agentName = (cfg?.realtorName || "Catherine").split(" ")[0]
  const now = Date.now()
  let sent = 0

  for (const w of WINDOWS) {
    const appts = await prisma.appointment.findMany({
      where: {
        status: "SCHEDULED",
        contactId: { not: null },
        createdAt: { gte: REMIND_BOOKED_AFTER },
        startTime: { gt: new Date(now + w.fromMin * 60000), lte: new Date(now + w.toMin * 60000) },
      },
      select: {
        id: true, startTime: true, location: true,
        contact: { select: { id: true, firstName: true, phone: true, email: true, doNotText: true, doNotEmail: true } },
      },
    })

    for (const a of appts) {
      const c = a.contact
      if (!c) continue
      const marker = `APPT_REMINDER_${w.kind}:${a.id}`
      const done = await prisma.activity.findFirst({ where: { contactId: c.id, type: "APPT_REMINDER", metadata: marker }, select: { id: true } })
      if (done) continue

      const when = formatEastern(a.startTime)
      const zoom = a.location?.startsWith("Zoom") ? a.location.replace(/^Zoom\s*—\s*/, "") : null
      const how = zoom ? `Zoom: ${zoom}` : `${agentName} te llamara a este numero.`
      const text = w.kind === "24H"
        ? `Hola ${c.firstName}, te recuerdo tu cita con ${agentName} manana, ${when} (hora de Miami). ${how} Si necesitas cambiarla, responde a este mensaje.`
        : `Hola ${c.firstName}, tu cita con ${agentName} es en 1 hora (${when}). ${how}`

      let ok = false
      if (c.phone && !c.doNotText) {
        ok = !!(await sendSMS(c.phone, text, undefined, { contactId: c.id }).catch(() => null))
      }
      if (w.kind === "24H" && c.email && !c.doNotEmail) {
        const html = wrapEmail(`
          <p style="color:#374151;font-size:15px;margin:0 0 12px">¡Hola ${c.firstName}!</p>
          <p style="color:#374151;font-size:14px;margin:0 0 12px">Te recuerdo tu cita con ${agentName} <strong>mañana, ${when}</strong> (hora de Miami).</p>
          <p style="color:#374151;font-size:14px;margin:0 0 12px">${zoom ? `Únete por Zoom: <a href="${zoom}">${zoom}</a>` : `${agentName} te llamará al número que nos diste.`}</p>
          <p style="color:#6b7280;font-size:14px;margin:0">¿Necesitas cambiar la hora? Responde a este correo.</p>
        `, { agentName, agentPhone: cfg?.realtorPhone || undefined, agentEmail: cfg?.realtorEmail || "" })
        ok = (await sendEmail({ to: c.email, transactional: true, subject: `Recordatorio: tu cita con ${agentName} mañana`, html }).catch(() => false)) || ok
      }
      if (!ok) continue
      sent++
      await prisma.activity.create({
        data: { type: "APPT_REMINDER", title: `Recordatorio de cita enviado (${w.kind === "24H" ? "24 h" : "1 h"})`, contactId: c.id, metadata: marker },
      }).catch(() => {})
    }
  }

  return NextResponse.json({ ok: true, sent })
}
