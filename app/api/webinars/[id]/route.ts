export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { findProject } from "@/lib/investment-projects"
import { deleteMeeting } from "@/lib/zoom"
import { sendEmail, wrapEmail } from "@/lib/email"
import { parseTags } from "@/lib/webinar-invite"
import { slugify } from "@/lib/webinar-recurrence"

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.catherinegomezrealtor.com"

const whenText = (d: Date, tz: string) =>
  new Intl.DateTimeFormat("es-US", {
    timeZone: tz, weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true,
  }).format(d)

/**
 * Tell the people registered for a webinar that its date changed or that it
 * was cancelled. Email only (free, and every registrant has one); best effort.
 */
async function notifyRegistrants(
  webinarId: string,
  kind: "MOVED" | "CANCELLED",
): Promise<number> {
  const w = await prisma.webinar.findUnique({
    where: { id: webinarId },
    select: { title: true, slug: true, startsAt: true, timezone: true, registrations: { select: { email: true, firstName: true } } },
  })
  if (!w) return 0
  const cfg = await prisma.aIConfig.findFirst({ select: { calendlyUrl: true, realtorName: true, realtorPhone: true } }).catch(() => null)
  const book = cfg?.calendlyUrl || `${BASE}/book`
  let sent = 0
  for (const r of w.registrations) {
    const hi = r.firstName ? `Hola ${r.firstName},` : "Hola,"
    const html = kind === "MOVED"
      ? wrapEmail(`
          <p>${hi}</p>
          <p>Cambiamos la fecha del webinar <strong>${w.title}</strong>. Ahora es el <strong>${whenText(w.startsAt, w.timezone)}</strong> (hora de Miami).</p>
          <p>Tu registro sigue activo: no tienes que hacer nada. Te enviaremos el enlace para entrar antes de empezar.</p>
          <p><a href="${BASE}/webinar/${w.slug}" style="color:#4F46E5;font-weight:700">Ver los detalles del webinar →</a></p>`,
          { agentName: cfg?.realtorName || "Catherine Gomez", agentPhone: cfg?.realtorPhone || undefined })
      : wrapEmail(`
          <p>${hi}</p>
          <p>Tuvimos que cancelar el webinar <strong>${w.title}</strong>. Te pedimos disculpas.</p>
          <p>Te avisaremos de la próxima sesión. Si prefieres no esperar, Catherine te atiende en una llamada de 20 minutos: <a href="${book}" style="color:#4F46E5;font-weight:700">elige tu hora aquí</a>.</p>`,
          { agentName: cfg?.realtorName || "Catherine Gomez", agentPhone: cfg?.realtorPhone || undefined })
    const ok = await sendEmail({
      to: r.email,
      transactional: true,
      subject: kind === "MOVED" ? `Nueva fecha: ${w.title}` : `Cancelado: ${w.title}`,
      html,
    }).catch(() => false)
    if (ok) sent++
  }
  return sent
}

/**
 * Edit one webinar after the fact. In practice this is two jobs: pasting in
 * the replay URL once the recording is processed, and cancelling a session.
 *
 * The replay matters more than it looks — it is what turns one Thursday night
 * into a page that keeps bringing registrations months later.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 })
  }

  const data: any = {}
  if (body.replayUrl !== undefined) {
    const url = String(body.replayUrl || "").trim()
    data.replayUrl = url || null
    // Stamped only when a URL is actually set, so the replay page can say when
    // the recording went up rather than when the row was last touched.
    data.replayPostedAt = url ? new Date() : null
  }
  if (body.status !== undefined) {
    const status = String(body.status)
    if (!["SCHEDULED", "LIVE", "ENDED", "CANCELLED"].includes(status)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 })
    }
    data.status = status
  }
  const current = await prisma.webinar.findUnique({
    where: { id: params.id },
    select: { startsAt: true, durationMins: true, status: true, zoomMeetingId: true, series: true, title: true },
  })
  if (!current) return NextResponse.json({ error: "No existe ese webinar" }, { status: 404 })

  // Weekly series on/off. Needs a series name to chain the weeks together.
  if (body.repeatWeekly !== undefined) {
    data.repeatWeekly = body.repeatWeekly === true
    if (data.repeatWeekly && !current.series) data.series = slugify(current.title) || "webinar"
  }
  if (body.autoInviteTags !== undefined) data.autoInviteTags = JSON.stringify(parseTags(body.autoInviteTags))

  // Moving the date or the length: only for a session that hasn't happened.
  let moved = false
  if (body.startsAt !== undefined || body.durationMins !== undefined) {
    if (current.status !== "SCHEDULED") {
      return NextResponse.json({ error: "Solo se puede cambiar la fecha de un webinar programado." }, { status: 400 })
    }
    if (body.startsAt !== undefined) {
      const d = new Date(String(body.startsAt))
      if (isNaN(d.getTime())) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 })
      if (d.getTime() < Date.now()) return NextResponse.json({ error: "La nueva fecha ya pasó." }, { status: 400 })
      if (d.getTime() !== current.startsAt.getTime()) { data.startsAt = d; moved = true }
    }
    if (body.durationMins !== undefined) {
      const mins = Math.max(10, Math.min(480, Number(body.durationMins) || current.durationMins))
      if (mins !== current.durationMins) { data.durationMins = mins; moved = true }
    }
  }
  const cancelling = data.status === "CANCELLED" && current.status !== "CANCELLED"

  // The Zoom meeting was booked for the old time: delete it and let the
  // reminder job book a fresh one (3 days before the new time). Same on cancel.
  if ((moved || cancelling) && current.zoomMeetingId) {
    const del = await deleteMeeting(current.zoomMeetingId)
    if (!del.ok) console.warn(`[webinars] Zoom delete failed for ${params.id}: ${del.error}`)
    data.zoomMeetingId = null
    data.zoomJoinUrl = null
    data.zoomStartUrl = null
  }

  if (body.title !== undefined) data.title = String(body.title).trim()
  if (body.description !== undefined) data.description = String(body.description).trim()
  if (body.projectSlug !== undefined) {
    // Same guard as on create: an unknown slug becomes a 404 link on a public
    // page, so it is rejected rather than stored.
    const wanted = String(body.projectSlug || "").trim()
    if (wanted && !findProject(wanted)) {
      return NextResponse.json({ error: `No existe el proyecto "${wanted}".` }, { status: 400 })
    }
    data.projectSlug = wanted || null
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada que cambiar" }, { status: 400 })
  }
  if (data.title === "") return NextResponse.json({ error: "El título no puede quedar vacío" }, { status: 400 })

  const updated = await prisma.webinar.update({
    where: { id: params.id },
    data,
    select: { id: true, slug: true, status: true, replayUrl: true },
  }).catch(() => null)

  if (!updated) return NextResponse.json({ error: "No existe ese webinar" }, { status: 404 })

  // New date: the reminders already sent were for the old time, so the
  // 1-day / 1-hour / "en vivo" ones go out again for the new one.
  if (moved && data.startsAt) {
    await prisma.webinarRegistration.updateMany({
      where: { webinarId: params.id, lastStage: { in: ["REMINDER_1D", "REMINDER_1H", "LIVE"] } },
      data: { lastStage: null },
    })
  }
  let notified = 0
  if (body.notify === true && (cancelling || (moved && data.startsAt))) {
    notified = await notifyRegistrants(params.id, cancelling ? "CANCELLED" : "MOVED")
  }

  // How many people got the follow-up back when the recording was still
  // processing, and are therefore waiting on the "ya está lista" send that the
  // reminder cron makes on its next pass. Reported back so the dashboard can
  // say what pasting the link actually set in motion, instead of only "guardado".
  let replayQueued = 0
  if (updated.replayUrl) {
    replayQueued = await prisma.webinarRegistration.count({
      where: { webinarId: params.id, lastStage: "FOLLOWUP", replaySentAt: null },
    })
  }

  return NextResponse.json({ ok: true, webinar: updated, replayQueued, notified })
}

/**
 * The registrant list, with what each person actually did.
 *
 * Sorted by watched time rather than by name: the top of this list is the
 * people worth calling, which is the only reason to open it.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const webinar = await prisma.webinar.findUnique({
    where: { id: params.id },
    select: { id: true, slug: true, title: true, startsAt: true, durationMins: true, status: true },
  })
  if (!webinar) return NextResponse.json({ error: "No existe ese webinar" }, { status: 404 })

  const registrations = await prisma.webinarRegistration.findMany({
    where: { webinarId: params.id },
    // Live attendance first, then replay watching: both are "how much of this
    // did they actually take in", and someone who watched 80% of the recording
    // is a better call than someone who registered and vanished.
    orderBy: [{ watchedPct: "desc" }, { replayPct: "desc" }, { createdAt: "asc" }],
    select: {
      id: true, email: true, firstName: true, lastName: true, phone: true,
      source: true, attended: true, watchedPct: true, secondsAttended: true,
      firstJoinedAt: true, lastStage: true, contactId: true, createdAt: true,
      replayPct: true, replaySeconds: true, replayFirstAt: true,
    },
  })

  return NextResponse.json({ webinar, registrations })
}

/**
 * Delete a webinar outright — only when nobody has registered (one created by
 * mistake). With registrants it is cancelled instead, so the contacts, their
 * attendance and the history stay.
 */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const w = await prisma.webinar.findUnique({
    where: { id: params.id },
    select: { zoomMeetingId: true, _count: { select: { registrations: true } } },
  })
  if (!w) return NextResponse.json({ error: "No existe ese webinar" }, { status: 404 })
  if (w._count.registrations > 0) {
    return NextResponse.json({ error: "Este webinar tiene personas registradas: cancélalo en vez de eliminarlo." }, { status: 409 })
  }
  if (w.zoomMeetingId) await deleteMeeting(w.zoomMeetingId).catch(() => null)
  await prisma.webinar.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
