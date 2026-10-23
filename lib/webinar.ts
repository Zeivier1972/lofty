import { prisma } from "@/lib/prisma"
import { ingestLead } from "@/lib/lead-ingest"
import { watchedPercent } from "@/lib/zoom"
import type { CapiBrowserSignals } from "@/lib/facebook"

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
  | { ok: true; webinarTitle: string; startsAt: Date; joinUrl: string | null; alreadyRegistered: boolean }
  | { ok: false; error: string }

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
    select: { id: true },
  })

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
    },
    update: {
      // Fill blanks; a second signup should not wipe a phone number captured
      // the first time with a form that left it empty.
      ...(contactId ? { contactId } : {}),
      ...(input.lastName?.trim() ? { lastName: input.lastName.trim() } : {}),
      ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
    },
  })

  return {
    ok: true,
    webinarTitle: webinar.title,
    startsAt: webinar.startsAt,
    joinUrl: webinar.zoomJoinUrl,
    alreadyRegistered: !!existing,
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
