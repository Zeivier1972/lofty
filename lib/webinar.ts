import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"
import { ingestLead } from "@/lib/lead-ingest"
import { handleLeadEngaged } from "@/lib/lead-flow"
import { watchedPercent } from "@/lib/zoom"
import type { CapiBrowserSignals } from "@/lib/facebook"
import { sendEmail } from "@/lib/email"
import { sendSMS, toE164 } from "@/lib/sms"

/**
 * Webinar registration and attendance.
 *
 * A signup here is a lead, so it goes through `ingestLead` rather than creating
 * a Contact directly: that is what dedupes against the existing book by email
 * or phone, un-archives somebody who had been filed away, fills blanks without
 * overwriting what is already on the record, records SMS consent, and triggers
 * Smart Plan enrolment off the tag. Writing a fresh Contact here would quietly
 * create a second row for a person already in the CRM — which is exactly the
 * duplicate-contact problem that makes the same message go out twice.
 */

/** How much of the session counts as "really attended". */
export const ATTENDED_PCT_THRESHOLD = 60

/**
 * How much of the recording counts as a buying signal.
 *
 * Lower than the live threshold on purpose. Sitting through 60% of a live hour
 * means blocking out an evening; watching half a recording means choosing it
 * over everything else available at that moment, usually on a phone, usually
 * alone. The second is a weaker commitment of time and a stronger signal of
 * intent, and it arrives while the person is still thinking about it.
 */
export const REPLAY_ENGAGED_PCT = 50

/** A heartbeat lands every 15s of playback; 25 absorbs jitter and a slow tab. */
const HEARTBEAT_MAX_CREDIT_SECS = 25

/** Opaque, unguessable, and not the row id — this ends up in forwarded links. */
export function newWatchToken(): string {
  return randomUUID().replace(/-/g, "")
}

/** The replay link to put in a mail, carrying who it was sent to. */
export function replayWatchUrl(slug: string, watchToken?: string | null): string {
  const base = `${BASE}/webinar/${slug}/replay`
  return watchToken ? `${base}?w=${watchToken}` : base
}

export type RegisterInput = {
  slug: string
  email: string
  firstName: string
  lastName?: string
  phone?: string
  /** utm_source, "replay", "instagram" — whatever brought them. */
  source?: string
  smsConsent?: boolean
  /** Browser signals for the Facebook Lead event — see lib/facebook. */
  capi?: CapiBrowserSignals
}

export type RegisterResult =
  | {
      ok: true
      webinarTitle: string
      startsAt: Date
      joinUrl: string | null
      alreadyRegistered: boolean
      /** Whether the confirmation actually went out — the page says so only if it did. */
      confirmationSent: boolean
    }
  | { ok: false; error: string }

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.catherinegomezrealtor.com"

const whenIn = (d: Date, tz: string) =>
  new Intl.DateTimeFormat("es-US", {
    timeZone: tz, weekday: "long", day: "numeric", month: "long",
    hour: "numeric", minute: "2-digit", hour12: true,
  }).format(d)

/** Google Calendar wants YYYYMMDDTHHMMSSZ. */
const gcalStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")

/**
 * "Add to calendar" as a link rather than an .ics attachment: sendEmail takes
 * no attachments, and a calendar entry is the single thing that most moves
 * whether somebody actually turns up.
 */
function calendarUrl(w: { title: string; description: string; startsAt: Date; durationMins: number }, joinUrl: string): string {
  const end = new Date(w.startsAt.getTime() + w.durationMins * 60000)
  const qs = new URLSearchParams({
    action: "TEMPLATE",
    text: w.title,
    dates: `${gcalStamp(w.startsAt)}/${gcalStamp(end)}`,
    details: `${w.description}\n\n${joinUrl}`,
    location: joinUrl,
  })
  return `https://calendar.google.com/calendar/render?${qs.toString()}`
}

/** Below this, waiting for the live session is not much of a wait. */
const ON_DEMAND_OFFER_HOURS = 20

/**
 * "Don't wait until Thursday — here is last week's, now."
 *
 * This is the piece that makes the recording an acquisition channel rather than
 * a consolation prize. Someone who sees an ad at 9pm Tuesday is interested at
 * 9pm Tuesday; by Thursday they have cooled off, and the industry's 35-50%
 * show-up rates are mostly that gap. Offering the previous session closes it
 * while the intent is still there.
 *
 * Stays honest about what it is: the recording is called a recording, the live
 * session keeps its own billing above, and the one thing the live has that the
 * recording does not — being able to ask — is the reason given to still come.
 * No "starting in 4 minutes" on a video from last week.
 *
 * Returns "" when there is nothing to offer, which is the common case early on.
 */
async function onDemandBlock(
  w: { id: string; startsAt: Date; series: string | null },
  watchToken: string,
): Promise<string> {
  const hoursAway = (w.startsAt.getTime() - Date.now()) / 3600000
  if (!w.series || hoursAway < ON_DEMAND_OFFER_HOURS) return ""

  const previous = await prisma.webinar
    .findFirst({
      where: {
        series: w.series,
        id: { not: w.id },
        replayUrl: { not: null },
        startsAt: { lt: new Date() },
        status: { not: "CANCELLED" },
      },
      orderBy: { startsAt: "desc" },
      select: { slug: true, title: true },
    })
    .catch(() => null)
  if (!previous) return ""

  return `<table style="width:100%;background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:16px;margin:22px 0">
    <tr><td>
      <p style="color:#0c4a6e;font-weight:bold;margin:0 0 6px">¿No quieres esperar?</p>
      <p style="color:#334155;line-height:1.6;margin:0 0 12px;font-size:14px">
        Puedes ver ahora mismo la grabación completa de la sesión anterior. El jueves en vivo
        es para preguntar lo tuyo — eso es lo único que la grabación no te da.
      </p>
      <a href="${replayWatchUrl(previous.slug, watchToken)}" style="color:#0369a1;font-weight:bold;text-decoration:none">Ver la grabación ahora →</a>
    </td></tr>
  </table>`
}

/**
 * The confirmation, sent the moment somebody registers.
 *
 * This was missing: registration created the row and the reminders fired a day
 * and an hour out, but nothing arrived at signup — while the page claimed a
 * confirmation had been sent. For a webinar that gap is the whole funnel,
 * because this is the mail people search for when it is time to join, and the
 * one that gets the event onto their calendar.
 *
 * Marked transactional so Gmail keeps it in Primary instead of Promotions,
 * where a join link is no use to anyone.
 */
async function sendConfirmation(
  w: { id: string; slug: string; title: string; description: string; startsAt: Date; durationMins: number; timezone: string; zoomJoinUrl: string | null; series: string | null },
  to: { email: string; firstName: string; phone?: string | null; contactId: string | null; smsConsent?: boolean; watchToken: string },
): Promise<boolean> {
  const first = (to.firstName || "").split(" ")[0]
  const pageUrl = `${BASE}/webinar/${w.slug}`
  const joinUrl = w.zoomJoinUrl || pageUrl

  const local = whenIn(w.startsAt, w.timezone)
  const bogota = whenIn(w.startsAt, "America/Bogota")
  const sameClock =
    new Intl.DateTimeFormat("en-US", { timeZone: w.timezone, hour: "numeric", minute: "2-digit" }).format(w.startsAt) ===
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" }).format(w.startsAt)

  const linkBlock = w.zoomJoinUrl
    ? `<p style="text-align:center;margin:24px 0"><a href="${joinUrl}" style="background:#0369a1;color:#fff;padding:14px 32px;border-radius:50px;text-decoration:none;font-weight:bold;display:inline-block">Entrar al webinar</a></p>
       <p style="color:#64748b;font-size:13px;text-align:center">Guarda este correo — es tu enlace para entrar.</p>`
    : `<p style="color:#334155;line-height:1.6">Te enviamos el enlace para entrar por correo antes de que empiece.</p>`

  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:8px 0">
    <h2 style="color:#0c4a6e;margin:0 0 6px">${first}, tu lugar está reservado ✅</h2>
    <p style="color:#334155;line-height:1.6;margin:0 0 18px">${w.title}</p>
    <table style="width:100%;background:#f8fafc;border-radius:12px;padding:16px;margin:0 0 6px">
      <tr><td style="color:#0f172a;font-weight:bold;text-transform:capitalize">${local}</td></tr>
      <tr><td style="color:#64748b;font-size:13px">hora de Miami</td></tr>
      ${sameClock ? "" : `<tr><td style="color:#0f172a;font-weight:bold;padding-top:8px;text-transform:capitalize">${bogota}</td></tr>
      <tr><td style="color:#64748b;font-size:13px">hora de Colombia</td></tr>`}
    </table>
    ${linkBlock}
    <p style="text-align:center;margin:18px 0"><a href="${calendarUrl(w, joinUrl)}" style="color:#0369a1;font-weight:bold">Agregar a mi calendario</a></p>
    <p style="color:#334155;line-height:1.6">Te recordamos un día antes y una hora antes. Al final hay preguntas abiertas — esa parte no queda en la grabación.</p>
    ${await onDemandBlock(w, to.watchToken)}
    <p style="color:#64748b;font-size:12px;margin-top:26px;border-top:1px solid #e2e8f0;padding-top:14px">
      Catherine Gomez, Realtor · 305-283-0872<br/><a href="${BASE}" style="color:#64748b">catherinegomezrealtor.com</a>
    </p></div>`

  let sent = false
  await sendEmail({
    to: to.email,
    subject: `✅ Estás registrado: ${w.title}`,
    html,
    transactional: true,
  }).then(ok => { sent = !!ok }).catch(e => console.error("[webinar] confirmation email failed:", e))

  // SMS only with consent — the checkbox on the form is what makes it lawful.
  if (to.phone && to.smsConsent) {
    await sendSMS(
      toE164(to.phone),
      `${first}, quedaste registrado para "${w.title}". ${local} (hora de Miami). Enlace 👉 ${joinUrl}`,
      undefined,
      { automated: true, contactId: to.contactId || undefined },
    ).catch(() => {})
  }

  return sent
}

export function normalizeEmail(raw: string): string {
  return (raw || "").trim().toLowerCase()
}

/** The tag a webinar signup gets, so Smart Plans can fire off it. */
export function webinarTag(w: { series?: string | null; slug: string }): string {
  return `Webinar: ${w.series || w.slug}`
}

export async function registerForWebinar(input: RegisterInput): Promise<RegisterResult> {
  const email = normalizeEmail(input.email)
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, error: "Necesitamos un correo válido para enviarte el enlace." }
  }
  const firstName = (input.firstName || "").trim()
  if (!firstName) return { ok: false, error: "¿Cómo te llamas?" }

  const webinar = await prisma.webinar.findUnique({ where: { slug: input.slug } })
  if (!webinar) return { ok: false, error: "Ese webinar no existe." }
  if (webinar.status === "CANCELLED") return { ok: false, error: "Ese webinar fue cancelado." }

  // The lead goes in first: the registration row wants a contactId, and a
  // signup is worth keeping even if everything after this fails.
  let contactId: string | null = null
  try {
    const res = await ingestLead({
      firstName,
      lastName: input.lastName?.trim() || undefined,
      email,
      phone: input.phone?.trim() || undefined,
      source: "WEBSITE",
      campaign: `Webinar ${webinar.series || webinar.slug}`,
      notes: `Se registró al webinar "${webinar.title}" (${webinar.startsAt.toISOString()})`,
      smsConsent: input.smsConsent,
      tags: [webinarTag(webinar)],
      capi: input.capi,
    })
    contactId = res.contactId
  } catch (e) {
    // Don't lose the signup over a CRM hiccup — the registration row below is
    // what the reminders read, and it carries the email on its own.
    console.error("[webinar] ingestLead failed, keeping the registration anyway:", e)
  }

  // Upsert on (webinarId, email): signing up twice updates the details rather
  // than making a second row that gets counted — and reminded — twice.
  const existing = await prisma.webinarRegistration.findUnique({
    where: { webinarId_email: { webinarId: webinar.id, email } },
    select: { id: true, watchToken: true },
  })

  // Never reissued: a token already sitting in someone's inbox has to keep
  // working, so an existing one is reused and only a row predating the column
  // gets a fresh one.
  const watchToken = existing?.watchToken || newWatchToken()

  await prisma.webinarRegistration.upsert({
    where: { webinarId_email: { webinarId: webinar.id, email } },
    create: {
      webinarId: webinar.id,
      contactId,
      email,
      firstName,
      lastName: input.lastName?.trim() || null,
      phone: input.phone?.trim() || null,
      source: input.source?.slice(0, 120) || null,
      watchToken,
    },
    update: {
      // Fill blanks; a second signup should not wipe a phone number captured
      // the first time with a form that left it empty.
      ...(contactId ? { contactId } : {}),
      ...(input.lastName?.trim() ? { lastName: input.lastName.trim() } : {}),
      ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
      watchToken,
    },
  })

  const confirmationSent = await sendConfirmation(webinar, {
    email,
    firstName,
    phone: input.phone?.trim() || null,
    contactId,
    smsConsent: input.smsConsent,
    watchToken,
  })

  return {
    ok: true,
    webinarTitle: webinar.title,
    startsAt: webinar.startsAt,
    joinUrl: webinar.zoomJoinUrl,
    alreadyRegistered: !!existing,
    confirmationSent,
  }
}

/* ------------------------------------------------------------ attendance --- */

/**
 * Record that someone joined. Called from the Zoom webhook.
 *
 * Only the first join is stamped: people drop and rejoin, and overwriting
 * firstJoinedAt on the second one loses when they actually arrived.
 */
export async function recordJoin(opts: { zoomMeetingId: string; email: string | null; at: Date }): Promise<boolean> {
  const reg = await findRegistration(opts.zoomMeetingId, opts.email)
  if (!reg) return false
  await prisma.webinarRegistration.update({
    where: { id: reg.id },
    data: { attended: true, ...(reg.firstJoinedAt ? {} : { firstJoinedAt: opts.at }) },
  })
  return true
}

/**
 * Record that someone left, and add the session they just watched to their
 * running total.
 *
 * The total is accumulated rather than derived from last-leave-minus-first-join
 * because a person who joins, drops for forty minutes and comes back for the
 * last two would otherwise read as having watched the whole thing. Each
 * join/leave pair is measured from the later of their last join and the
 * webinar's own start, so arriving early and sitting in the room does not
 * inflate it.
 */
export async function recordLeave(opts: { zoomMeetingId: string; email: string | null; at: Date }): Promise<boolean> {
  const reg = await findRegistration(opts.zoomMeetingId, opts.email)
  if (!reg) return false

  const segmentStart = Math.max(
    reg.firstJoinedAt ? reg.firstJoinedAt.getTime() : opts.at.getTime(),
    reg.webinar.startsAt.getTime(),
  )
  // A leave with no recorded join, or one that arrives out of order, adds
  // nothing rather than a negative.
  const segmentSecs = Math.max(0, Math.round((opts.at.getTime() - segmentStart) / 1000))
  const seconds = reg.secondsAttended + segmentSecs

  await prisma.webinarRegistration.update({
    where: { id: reg.id },
    data: {
      attended: true,
      lastLeftAt: opts.at,
      secondsAttended: seconds,
      watchedPct: watchedPercent(seconds, reg.webinar.durationMins),
    },
  })
  return true
}

/* --------------------------------------------------- on-demand watching --- */

export type ReplayProgress = {
  registrationId: string
  /** Seconds credited so far, and the share of the recording they represent. */
  seconds: number
  pct: number
  /** True on the heartbeat that first crosses REPLAY_ENGAGED_PCT. */
  justCrossed: boolean
}

/**
 * Credit a heartbeat of replay watching to the person a link token identifies.
 *
 * The client posts every 15 seconds while the player is actually playing, and
 * sends its current position. We do NOT store that position: a viewer can drag
 * the scrubber to the last second and report 100%, and this number is going to
 * decide who gets asked for an appointment. Instead each beat credits the real
 * time since the previous one, capped — so sixty minutes of credit costs sixty
 * minutes of sitting there, whatever the player claims.
 *
 * Returns null for an unknown or missing token. The replay page is public by
 * design (that is what makes it rank), so most views have nobody to attribute
 * them to, and that is an ordinary outcome rather than an error.
 */
export async function recordReplayProgress(opts: {
  watchToken: string
  slug: string
  /** The recording's real length, as the player reports it. */
  durationSecs: number
}): Promise<ReplayProgress | null> {
  const token = (opts.watchToken || "").trim()
  if (!token) return null

  // The token identifies a person, via the registration it was issued for —
  // which is not necessarily the recording being watched. The confirmation mail
  // offers the *previous* session in the same series ("don't wait until
  // Thursday"), so the common case is a token from webinar B arriving on
  // webinar A's replay page.
  const holder = await prisma.webinarRegistration.findUnique({
    where: { watchToken: token },
    select: {
      id: true, email: true, contactId: true, firstName: true, lastName: true, phone: true,
      webinar: { select: { id: true, series: true } },
    },
  })
  if (!holder) return null

  const watched = await prisma.webinar.findUnique({
    where: { slug: opts.slug },
    select: { id: true, series: true, durationMins: true },
  })
  // Same session, or another in the same series — which is the whole set we
  // ever link to. A token cannot be pointed at an unrelated webinar's page.
  if (!watched) return null
  const sameSeries = !!watched.series && watched.series === holder.webinar.series
  if (watched.id !== holder.webinar.id && !sameSeries) return null

  // Credit the registration for the recording actually being watched, so the
  // per-webinar numbers mean what they say. Watching a session they never
  // signed up for creates that row — it is a true statement about them, and it
  // is what makes the replay a way in rather than only a consolation prize.
  // Marked as already followed-up so the past-webinar follow-up does not mail
  // them "te perdiste el webinar, aquí está la grabación" while they watch it.
  const reg = await prisma.webinarRegistration.upsert({
    where: { webinarId_email: { webinarId: watched.id, email: holder.email } },
    create: {
      webinarId: watched.id,
      contactId: holder.contactId,
      email: holder.email,
      firstName: holder.firstName,
      lastName: holder.lastName,
      phone: holder.phone,
      source: "replay",
      watchToken: newWatchToken(),
      lastStage: "FOLLOWUP",
      replaySentAt: new Date(),
    },
    update: {},
    select: {
      id: true, replaySeconds: true, replayPct: true, replayFirstAt: true, replayLastAt: true,
    },
  })

  const now = new Date()
  // The first beat fires the instant they press play, when nothing has been
  // watched yet — it starts the clock rather than crediting a block of time.
  // A gap longer than one beat (they came back tomorrow) credits one beat, not
  // the whole absence.
  const credit = reg.replayLastAt
    ? Math.max(0, Math.min((now.getTime() - reg.replayLastAt.getTime()) / 1000, HEARTBEAT_MAX_CREDIT_SECS))
    : 0

  // Prefer the player's own duration: a recording is nearly always shorter than
  // the slot that was booked for it, and dividing by the booked hour would read
  // a complete 40-minute watch as 67%. Falls back to the scheduled length when
  // the player has not reported one yet.
  const totalSecs =
    opts.durationSecs > 0 ? Math.round(opts.durationSecs) : watched.durationMins * 60
  const seconds = Math.min(reg.replaySeconds + credit, totalSecs)
  const pct = totalSecs > 0 ? Math.min(100, Math.round((seconds / totalSecs) * 100)) : 0

  await prisma.webinarRegistration.update({
    where: { id: reg.id },
    data: {
      replaySeconds: Math.round(seconds),
      replayPct: pct,
      replayLastAt: now,
      ...(reg.replayFirstAt ? {} : { replayFirstAt: now }),
    },
  })

  return {
    registrationId: reg.id,
    seconds: Math.round(seconds),
    pct,
    justCrossed: reg.replayPct < REPLAY_ENGAGED_PCT && pct >= REPLAY_ENGAGED_PCT,
  }
}

/**
 * Somebody just watched enough of the recording to be worth a phone call.
 *
 * The claim is a conditional update rather than a read-then-write: two
 * heartbeats can land in the same second, and both reading `replayEngagedAt`
 * as null would mean asking the same person for an appointment twice. Only the
 * update that actually changes a row goes on.
 *
 * Everything after that is the CRM's existing hand-off — `handleLeadEngaged`
 * moves them to Warm, cancels pending Sofia retries, pauses the educational
 * drip and puts a task on Catherine's list. Worth being explicit about the
 * drip: this treats watching half an investment webinar the same as replying
 * to a message. It is a one-way signal, so that is a deliberate call — a
 * person who just sat through forty minutes of numbers should get Catherine,
 * not another automated lesson.
 */
export async function handleReplayEngagement(registrationId: string): Promise<boolean> {
  const claimed = await prisma.webinarRegistration.updateMany({
    where: { id: registrationId, replayEngagedAt: null },
    data: { replayEngagedAt: new Date() },
  })
  if (claimed.count !== 1) return false

  const reg = await prisma.webinarRegistration.findUnique({
    where: { id: registrationId },
    select: {
      email: true, firstName: true, contactId: true, replayPct: true,
      webinar: { select: { title: true, slug: true } },
    },
  })
  if (!reg) return false

  const first = (reg.firstName || "").split(" ")[0] || "Hola"

  // The ask, while they are still on the page with the numbers fresh.
  await sendEmail({
    to: reg.email,
    subject: `${first}, ¿vemos tus números en concreto?`,
    transactional: true,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:8px 0">
      <h2 style="color:#0c4a6e;margin:0 0 6px">${first}, veo que llegaste lejos en el video</h2>
      <p style="color:#334155;line-height:1.6">Lo que sigue no está en la grabación: qué significan esos números <em>para ti</em> — tu presupuesto, si financias o no, cómo se ve desde tu país. Son 20 minutos y no hay nada que firmar.</p>
      <p style="text-align:center;margin:26px 0"><a href="${BASE}/book" style="background:#0369a1;color:#fff;padding:14px 32px;border-radius:50px;text-decoration:none;font-weight:bold;display:inline-block">Agendar 20 minutos</a></p>
      <p style="color:#64748b;font-size:13px">Si prefieres escribir primero, responde este correo y te contesto yo.</p>
      <p style="color:#64748b;font-size:12px;margin-top:26px;border-top:1px solid #e2e8f0;padding-top:14px">
        Catherine Gomez, Realtor · 305-283-0872<br/><a href="${BASE}" style="color:#64748b">catherinegomezrealtor.com</a>
      </p></div>`,
  }).catch(e => console.error("[webinar] replay booking ask failed:", e))

  // Only a matched contact can be routed; a registration whose ingestLead
  // failed still gets the mail above, and the dashboard still shows the watch.
  if (reg.contactId) {
    await handleLeadEngaged(
      reg.contactId,
      "grabación del webinar",
      `Vio ${reg.replayPct}% de "${reg.webinar.title}"`,
    ).catch(e => console.error("[webinar] lead hand-off failed:", e))
  }

  return true
}

/**
 * Match a Zoom participant back to a registration.
 *
 * By email, because that is the only thing the two sides share — Zoom's
 * participant name is whatever the attendee typed into their client. A
 * participant with no email, or one who joined with a different address than
 * they registered with, cannot be matched and is counted by the report
 * backfill instead; returning null here is a normal outcome, not an error.
 */
async function findRegistration(zoomMeetingId: string, email: string | null) {
  if (!email) return null
  return prisma.webinarRegistration.findFirst({
    where: {
      email: normalizeEmail(email),
      webinar: { zoomMeetingId },
    },
    select: {
      id: true,
      firstJoinedAt: true,
      secondsAttended: true,
      webinar: { select: { startsAt: true, durationMins: true } },
    },
  })
}
