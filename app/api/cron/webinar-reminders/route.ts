export const dynamic = "force-dynamic"
export const maxDuration = 300

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { sendSMS, toE164 } from "@/lib/sms"
import { createMeeting, zoomConfigured } from "@/lib/zoom"
import { ATTENDED_PCT_THRESHOLD, replayWatchUrl } from "@/lib/webinar"

/**
 * The webinar reminder sequence, and the follow-up that is the actual point.
 *
 * Runs every 15 minutes, because the one-hour and at-start sends need a
 * tighter window than a daily job can give. Each registration carries a
 * `lastStage`, and a stage only ever moves forward, so a second run inside the
 * same window sends nothing — the guard is in the data, not in the schedule.
 *
 * NOT built on /api/cron/event-reminders. That job serves the in-person
 * Colombia events off the hardcoded array in lib/events.ts, on a 7/3/1/0-day
 * countdown; a webinar needs hours, not days, and reads from the database.
 * Folding them together would mean rewriting a job that is already running and
 * sending real reminders, for no gain.
 *
 * Stages: REMINDER_1D → REMINDER_1H → LIVE → FOLLOWUP
 */

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.catherinegomezrealtor.com"
const STAGE_ORDER = ["REMINDER_1D", "REMINDER_1H", "LIVE", "FOLLOWUP"]

function authOk(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const url = new URL(req.url)
  return (
    req.headers.get("authorization") === `Bearer ${secret}` ||
    req.headers.get("x-cron-secret") === secret ||
    url.searchParams.get("secret") === secret
  )
}

/** Stages never go backwards, so a late delivery cannot re-send an earlier one. */
function alreadyPast(current: string | null, candidate: string): boolean {
  if (!current) return false
  return STAGE_ORDER.indexOf(current) >= STAGE_ORDER.indexOf(candidate)
}

const miami = (d: Date) =>
  new Intl.DateTimeFormat("es-US", {
    timeZone: "America/New_York", weekday: "long", day: "numeric", month: "long",
    hour: "numeric", minute: "2-digit", hour12: true,
  }).format(d)

function shell(body: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:8px 0">${body}
    <p style="color:#64748b;font-size:12px;margin-top:26px;border-top:1px solid #e2e8f0;padding-top:14px">
      Catherine Gomez, Realtor · 305-283-0872<br/>
      <a href="${BASE}" style="color:#64748b">catherinegomezrealtor.com</a>
    </p></div>`
}

export async function GET(req: Request) {
  if (!authOk(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const now = Date.now()
  const sent: Record<string, number> = { REMINDER_1D: 0, REMINDER_1H: 0, LIVE: 0, FOLLOWUP: 0, REPLAY_READY: 0 }
  const notes: string[] = []

  // ── 0. Create the Zoom meeting for anything starting in the next 3 days ───
  // Done here rather than at creation time so a webinar can be published and
  // take signups before the Zoom credentials exist — and so a meeting is not
  // sitting on Zoom's calendar for a session that gets cancelled next month.
  if (zoomConfigured()) {
    const needMeeting = await prisma.webinar.findMany({
      where: {
        zoomMeetingId: null,
        status: "SCHEDULED",
        startsAt: { gt: new Date(now), lte: new Date(now + 3 * 86400000) },
      },
      select: { id: true, title: true, description: true, startsAt: true, durationMins: true, timezone: true },
      take: 10,
    })
    for (const w of needMeeting) {
      const res = await createMeeting({
        topic: w.title,
        startsAt: w.startsAt,
        durationMins: w.durationMins,
        timezone: w.timezone,
        agenda: w.description,
      })
      if (res.ok) {
        await prisma.webinar.update({
          where: { id: w.id },
          data: { zoomMeetingId: res.meetingId, zoomJoinUrl: res.joinUrl, zoomStartUrl: res.startUrl },
        })
        notes.push(`✓ Zoom creado para "${w.title}"`)
      } else {
        notes.push(`✗ Zoom falló para "${w.title}": ${res.error}`)
      }
    }
  } else {
    notes.push("Zoom no configurado — los webinares siguen tomando registros sin enlace")
  }

  // ── 1-3. Pre-event reminders and the live nudge ───────────────────────────
  const upcoming = await prisma.webinar.findMany({
    where: {
      status: { in: ["SCHEDULED", "LIVE"] },
      startsAt: { gt: new Date(now - 60 * 60000), lte: new Date(now + 2 * 86400000) },
    },
    select: {
      id: true, slug: true, title: true, startsAt: true, zoomJoinUrl: true,
      registrations: {
        select: { id: true, email: true, firstName: true, phone: true, lastStage: true, contactId: true },
      },
    },
  })

  for (const w of upcoming) {
    const minsAway = (w.startsAt.getTime() - now) / 60000
    // Which send is due. Windows are generous on the late side because a run
    // can be skipped or slow; the stage guard stops the overlap being a double.
    const stage =
      minsAway <= 5 && minsAway > -60 ? "LIVE"
      : minsAway <= 75 && minsAway > 5 ? "REMINDER_1H"
      : minsAway <= 24 * 60 && minsAway > 75 ? "REMINDER_1D"
      : null
    if (!stage) continue

    const joinUrl = w.zoomJoinUrl || `${BASE}/webinar/${w.slug}`
    const when = miami(w.startsAt)

    for (const r of w.registrations) {
      if (alreadyPast(r.lastStage, stage)) continue
      const first = (r.firstName || "").split(" ")[0] || "Hola"

      const copy =
        stage === "LIVE"
          ? {
              subject: `🔴 Estamos en vivo — ${w.title}`,
              html: shell(`<h2 style="color:#0c4a6e">${first}, estamos empezando</h2>
                <p style="color:#334155;line-height:1.6">Entra ahora y te pongo al día en un minuto.</p>
                <p><a href="${joinUrl}" style="background:#0369a1;color:#fff;padding:14px 30px;border-radius:50px;text-decoration:none;font-weight:bold;display:inline-block">Entrar al webinar →</a></p>`),
              sms: `${first}, estamos EN VIVO con "${w.title}". Entra aquí 👉 ${joinUrl}`,
            }
          : stage === "REMINDER_1H"
          ? {
              subject: `⏰ En una hora: ${w.title}`,
              html: shell(`<h2 style="color:#0c4a6e">${first}, es en una hora</h2>
                <p style="color:#334155;line-height:1.6">Te dejo el enlace a mano para que no tengas que buscarlo: ${when} (hora de Miami).</p>
                <p><a href="${joinUrl}" style="background:#0369a1;color:#fff;padding:14px 30px;border-radius:50px;text-decoration:none;font-weight:bold;display:inline-block">Guardar el enlace →</a></p>`),
              sms: `${first}, en 1 hora empieza "${w.title}". Enlace 👉 ${joinUrl}`,
            }
          : {
              subject: `Mañana: ${w.title}`,
              html: shell(`<h2 style="color:#0c4a6e">${first}, nos vemos mañana</h2>
                <p style="color:#334155;line-height:1.6"><strong>${when}</strong> (hora de Miami). Vamos a ver los números reales del proyecto, y al final hay preguntas abiertas — esa parte no queda en la grabación.</p>
                <p><a href="${joinUrl}" style="background:#0369a1;color:#fff;padding:14px 30px;border-radius:50px;text-decoration:none;font-weight:bold;display:inline-block">Ver el enlace →</a></p>`),
              sms: `${first}, mañana es "${w.title}" (${when}, hora de Miami). Enlace 👉 ${joinUrl}`,
            }

      let delivered = false
      if (r.email) {
        await sendEmail({ to: r.email, subject: copy.subject, html: copy.html })
          .then(() => { delivered = true })
          .catch(e => notes.push(`✗ email ${r.email}: ${e.message}`))
      }
      if (r.phone) {
        // Automated path, so the do-not-text guard, the content dedupe and the
        // monthly cap all apply.
        await sendSMS(toE164(r.phone), copy.sms, undefined, { automated: true, contactId: r.contactId || undefined })
          .then(sid => { if (sid) delivered = true })
          .catch(() => {})
      }

      if (delivered) {
        await prisma.webinarRegistration.update({ where: { id: r.id }, data: { lastStage: stage } })
        sent[stage]++
      }
    }
  }

  // ── 4. The follow-up — where a webinar turns into a conversation ──────────
  // Split by what they actually did. Someone who watched past the threshold
  // gets asked for a call; a no-show gets the replay instead of a pitch. Runs
  // from 30 minutes after the end so the recording has a moment to land.
  const justEnded = await prisma.webinar.findMany({
    where: {
      startsAt: { gte: new Date(now - 7 * 86400000), lte: new Date(now) },
      status: { in: ["ENDED", "LIVE", "SCHEDULED"] },
    },
    select: {
      id: true, slug: true, title: true, startsAt: true, durationMins: true, replayUrl: true, series: true,
      registrations: {
        // `lastStage` is null for anyone who never got a reminder — someone who
        // registered ten minutes before the start, or whose email bounced. SQL
        // `!= 'FOLLOWUP'` is NULL rather than true for those rows, so relying on
        // `not` alone would silently drop exactly the people most worth
        // following up with. Spelled out so it cannot depend on how Prisma
        // chooses to compile `not` on a nullable column.
        where: { OR: [{ lastStage: null }, { lastStage: { not: "FOLLOWUP" } }] },
        select: {
          id: true, email: true, firstName: true, phone: true, contactId: true,
          attended: true, watchedPct: true, watchToken: true,
        },
      },
    },
  })

  for (const w of justEnded) {
    const endedAt = w.startsAt.getTime() + w.durationMins * 60000
    if (now < endedAt + 30 * 60000) continue

    // Which recording this follow-up can honestly point at.
    //
    // Its own, normally. But a session can end with none: nobody turned up so
    // it was never run, or it ran and the recording never got uploaded. The
    // follow-up still fires — it has to, a no-show who hears nothing that same
    // evening is gone — and it used to send everyone to this session's own
    // replay page, which in that case says "se está procesando" forever. A
    // promise that never resolves is worse than no promise.
    //
    // So it falls back to the series' most recent recording, which is usually
    // the standalone evergreen one. The watch token still works there: it
    // resolves against the recording actually being watched, not the session
    // that issued it.
    let replaySlug: string | null = w.replayUrl ? w.slug : null
    if (!replaySlug && w.series) {
      const stand = await prisma.webinar
        .findFirst({
          where: {
            series: w.series,
            id: { not: w.id },
            replayUrl: { not: null },
            status: { not: "CANCELLED" },
          },
          orderBy: { startsAt: "desc" },
          select: { slug: true },
        })
        .catch(() => null)
      replaySlug = stand?.slug ?? null
    }

    for (const r of w.registrations) {
      const first = (r.firstName || "").split(" ")[0] || "Hola"
      // Per person, not per webinar: the token is what turns a replay view into
      // a named one, and it is the only reason we know who to call afterwards.
      const replayLink = replaySlug ? replayWatchUrl(replaySlug, r.watchToken) : null
      const engaged = r.attended && r.watchedPct >= ATTENDED_PCT_THRESHOLD

      const copy = engaged
        ? {
            subject: `${first}, ¿vemos tu caso en concreto?`,
            html: shell(`<h2 style="color:#0c4a6e">Gracias por quedarte, ${first}</h2>
              <p style="color:#334155;line-height:1.6">Te quedaste hasta el final, así que supongo que los números te cuadraron. Lo siguiente es verlo con tu presupuesto y tu situación: 20 minutos, sin compromiso.</p>
              <p><a href="${BASE}/book" style="background:#0369a1;color:#fff;padding:14px 30px;border-radius:50px;text-decoration:none;font-weight:bold;display:inline-block">Agendar 20 minutos →</a></p>
              ${replayLink ? `<p style="color:#64748b;font-size:13px">También te dejo <a href="${replayLink}" style="color:#0369a1">la grabación</a> por si quieres repasar algo.</p>` : ""}`),
            sms: `${first}, gracias por quedarte en el webinar. ¿Vemos tu caso en 20 min? Agenda aquí 👉 ${BASE}/book`,
          }
        : r.attended
        ? replayLink
          ? {
              subject: `${first}, te dejo la grabación (te fuiste a mitad)`,
              html: shell(`<h2 style="color:#0c4a6e">${first}, aquí está la grabación</h2>
                <p style="color:#334155;line-height:1.6">Te tocó salir antes del final — la parte de los números y las preguntas está en la grabación.</p>
                <p><a href="${replayLink}" style="background:#0369a1;color:#fff;padding:14px 30px;border-radius:50px;text-decoration:none;font-weight:bold;display:inline-block">Ver la grabación →</a></p>`),
              sms: `${first}, te dejo la grabación del webinar por si quieres ver la parte que te perdiste 👉 ${replayLink}`,
            }
          // No recording anywhere in the series yet. Say what is true and make
          // the ask directly, rather than pointing at a page that will tell
          // them the video is still processing.
          : {
              subject: `${first}, ¿repasamos lo que te perdiste?`,
              html: shell(`<h2 style="color:#0c4a6e">${first}, te tocó salir antes</h2>
                <p style="color:#334155;line-height:1.6">La parte de los números quedó para el final. En vez de mandarte a verla, prefiero repasarla contigo en 20 minutos y de paso vemos tu caso.</p>
                <p><a href="${BASE}/book" style="background:#0369a1;color:#fff;padding:14px 30px;border-radius:50px;text-decoration:none;font-weight:bold;display:inline-block">Agendar 20 minutos →</a></p>`),
              sms: `${first}, te perdiste la parte de los numeros. Te los repaso en 20 min 👉 ${BASE}/book`,
            }
        : replayLink
        ? {
            subject: `${first}, te perdiste el webinar — aquí está la grabación`,
            html: shell(`<h2 style="color:#0c4a6e">${first}, sé que no pudiste entrar</h2>
              <p style="color:#334155;line-height:1.6">Pasa. Te dejo la grabación completa para que la veas cuando puedas.</p>
              <p><a href="${replayLink}" style="background:#0369a1;color:#fff;padding:14px 30px;border-radius:50px;text-decoration:none;font-weight:bold;display:inline-block">Ver la grabación →</a></p>`),
            sms: `${first}, te perdiste el webinar. Aquí está la grabación completa 👉 ${replayLink}`,
          }
        : {
            subject: `${first}, no pudiste entrar — te lo cuento en 20 minutos`,
            html: shell(`<h2 style="color:#0c4a6e">${first}, sé que no pudiste entrar</h2>
              <p style="color:#334155;line-height:1.6">Pasa. En vez de hacerte esperar a la próxima sesión, te propongo algo mejor: 20 minutos conmigo, y vemos los números directamente sobre tu caso.</p>
              <p><a href="${BASE}/book" style="background:#0369a1;color:#fff;padding:14px 30px;border-radius:50px;text-decoration:none;font-weight:bold;display:inline-block">Agendar 20 minutos →</a></p>`),
            sms: `${first}, no pudiste entrar al webinar. Te propongo 20 min conmigo y vemos los numeros 👉 ${BASE}/book`,
          }

      let delivered = false
      if (r.email) {
        await sendEmail({ to: r.email, subject: copy.subject, html: copy.html })
          .then(() => { delivered = true })
          .catch(e => notes.push(`✗ followup ${r.email}: ${e.message}`))
      }
      if (r.phone) {
        await sendSMS(toE164(r.phone), copy.sms, undefined, { automated: true, contactId: r.contactId || undefined })
          .then(sid => { if (sid) delivered = true })
          .catch(() => {})
      }

      if (delivered) {
        await prisma.webinarRegistration.update({
          where: { id: r.id },
          data: { lastStage: "FOLLOWUP", replaySentAt: w.replayUrl ? new Date() : null },
        })
        sent.FOLLOWUP++
      }
    }
  }

  // ── 5. "Ya está lista" — the send that closes the 30-minute race ──────────
  // Step 4 fires 30 minutes after the end whether or not a recording exists,
  // because a no-show who hears nothing that same evening is gone. But Zoom
  // needs longer than that to process an hour of video, so in practice the
  // first follow-up usually points at a page that says "se está procesando" —
  // and nobody goes back to a page that had nothing the first time.
  //
  // `replaySentAt` is what records whether the link was real when it went out.
  // This is the loop that reads it: once the recording lands, everyone who got
  // the placeholder gets told, once. Without it, pasting the replay URL late
  // means the recording simply never reaches the people it was recorded for.
  const nowReplayable = await prisma.webinar.findMany({
    where: {
      replayUrl: { not: null },
      startsAt: { gte: new Date(now - 30 * 86400000), lte: new Date(now) },
      status: { not: "CANCELLED" },
    },
    select: {
      slug: true, title: true, startsAt: true, replayPostedAt: true,
      registrations: {
        // Only the people step 4 already reached, and only those whose copy
        // carried a link to an empty page. Anyone whose follow-up went out
        // after the recording existed already has it.
        where: { lastStage: "FOLLOWUP", replaySentAt: null },
        select: { id: true, email: true, firstName: true, phone: true, contactId: true, watchToken: true },
      },
    },
  })

  for (const w of nowReplayable) {
    // Bounded on purpose. A hard-bouncing address never sets `replaySentAt`,
    // and nothing else moves the row forward, so without this the job would
    // retry the same dead address every 15 minutes for a month.
    const postedAt = (w.replayPostedAt || w.startsAt).getTime()
    if (now > postedAt + 3 * 86400000) continue

    for (const r of w.registrations) {
      const first = (r.firstName || "").split(" ")[0] || "Hola"
      const replayLink = replayWatchUrl(w.slug, r.watchToken)
      const subject = `${first}, ya está lista la grabación de "${w.title}"`
      const html = shell(`<h2 style="color:#0c4a6e">${first}, ya puedes verla</h2>
        <p style="color:#334155;line-height:1.6">Cuando te escribí, la grabación todavía se estaba procesando. Ya quedó lista — aquí la tienes completa.</p>
        <p><a href="${replayLink}" style="background:#0369a1;color:#fff;padding:14px 30px;border-radius:50px;text-decoration:none;font-weight:bold;display:inline-block">Ver la grabación →</a></p>
        <p style="color:#64748b;font-size:13px">Si prefieres que veamos tus números directamente, <a href="${BASE}/book" style="color:#0369a1">agenda 20 minutos aquí</a>.</p>`)

      let delivered = false
      if (r.email) {
        await sendEmail({ to: r.email, subject, html })
          .then(() => { delivered = true })
          .catch(e => notes.push(`✗ replay ${r.email}: ${e.message}`))
      } else if (r.phone) {
        // SMS only when there is no email to send to. Step 4 already texted
        // this person this same link; a second text carrying it would read as a
        // duplicate, where the email at least leads with what changed.
        await sendSMS(toE164(r.phone), `${first}, ya está lista la grabación del webinar 👉 ${replayLink}`,
          undefined, { automated: true, contactId: r.contactId || undefined })
          .then(sid => { if (sid) delivered = true })
          .catch(() => {})
      }

      if (delivered) {
        await prisma.webinarRegistration.update({
          where: { id: r.id },
          data: { replaySentAt: new Date() },
        })
        sent.REPLAY_READY++
      }
    }
  }

  return NextResponse.json({ ok: true, sent, notes: notes.slice(0, 50) })
}
