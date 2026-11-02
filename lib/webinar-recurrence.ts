import { prisma } from "@/lib/prisma"
import { parseTags, sendWebinarInvite } from "@/lib/webinar-invite"

/**
 * Weekly webinars ("todos los jueves a las 7").
 *
 * Only the newest session of a series carries `repeatWeekly`. Once it is over
 * (or cancelled), the next week's session is created as a copy — same title,
 * description, project, length, cover and series — and the flag moves to the
 * copy. Switching the flag off on the current session ends the series.
 *
 * Runs from the webinar-reminders cron (every 15 minutes). The reminder job
 * then books the Zoom meeting three days before, as for any webinar.
 */

const WEEK = 7 * 86400000
const ZONE = "America/New_York"

export function slugify(raw: string): string {
  return (raw || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

/** Miami wall-clock parts of an instant. */
function miamiParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d)
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value || 0)
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute") }
}

/**
 * The same Miami wall-clock time `weeks` weeks later. Adding 7×24h would drift
 * an hour across the DST change (7 PM would become 6 PM in November).
 */
export function sameTimeWeeksLater(start: Date, weeks: number): Date {
  const p = miamiParts(start)
  const guess = new Date(Date.UTC(p.y, p.m - 1, p.d + 7 * weeks, p.h, p.min))
  // guess is the wall time read as UTC; shift by Miami's offset on that date.
  const q = miamiParts(guess)
  const asUtc = Date.UTC(q.y, q.m - 1, q.d, q.h, q.min)
  return new Date(guess.getTime() + (guess.getTime() - asUtc))
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base
  for (let i = 2; i < 50; i++) {
    const taken = await prisma.webinar.findUnique({ where: { slug }, select: { id: true } })
    if (!taken) return slug
    slug = `${base}-${i}`
  }
  return `${base}-${Date.now()}`
}

export async function ensureWeeklyWebinars(now = Date.now()): Promise<string[]> {
  const notes: string[] = []
  const chains = await prisma.webinar.findMany({
    where: { repeatWeekly: true },
    select: {
      id: true, slug: true, series: true, title: true, description: true, projectSlug: true,
      startsAt: true, durationMins: true, timezone: true, language: true, status: true,
      coverImageUrl: true, autoInviteTags: true,
    },
  })

  for (const w of chains) {
    const over = w.startsAt.getTime() + w.durationMins * 60000 < now
    if (!over && w.status !== "CANCELLED") continue

    // First weekly slot after both the session and now.
    let weeks = 1
    let next = sameTimeWeeksLater(w.startsAt, weeks)
    while (next.getTime() <= now + 60 * 60000 && weeks < 60) next = sameTimeWeeksLater(w.startsAt, ++weeks)

    const series = w.series || slugify(w.title) || "webinar"
    const exists = await prisma.webinar.findFirst({
      where: { series, startsAt: next, status: { not: "CANCELLED" } },
      select: { id: true },
    })

    await prisma.$transaction(async tx => {
      // Claim the hand-off first so two overlapping runs cannot both copy.
      const claimed = await tx.webinar.updateMany({
        where: { id: w.id, repeatWeekly: true },
        data: { repeatWeekly: false, series },
      })
      if (claimed.count === 0) return
      if (exists) {
        await tx.webinar.update({ where: { id: exists.id }, data: { repeatWeekly: true, autoInviteTags: w.autoInviteTags } })
        return
      }
      const day = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(next)
      const slug = await uniqueSlug(`${slugify(w.title) || "webinar"}-${day}`.slice(0, 72))
      await tx.webinar.create({
        data: {
          slug, series, title: w.title, description: w.description, projectSlug: w.projectSlug,
          startsAt: next, durationMins: w.durationMins, timezone: w.timezone, language: w.language,
          coverImageUrl: w.coverImageUrl, repeatWeekly: true, autoInviteTags: w.autoInviteTags,
        },
      })
      notes.push(`🔁 Próxima sesión semanal creada: "${w.title}" ${day}`)
    })
  }

  // Automatic invitation, two days before, to the series' tags. Email only:
  // texting a list every week costs money and wears out the permission.
  const due = await prisma.webinar.findMany({
    where: {
      repeatWeekly: true,
      status: "SCHEDULED",
      invitedAt: null,
      autoInviteTags: { not: "[]" },
      startsAt: { gt: new Date(now + 3 * 3600000), lte: new Date(now + 2 * 86400000) },
    },
    select: { id: true, title: true, autoInviteTags: true },
  })
  for (const w of due) {
    const tags = parseTags(w.autoInviteTags)
    if (!tags.length) continue
    const r = await sendWebinarInvite(w.id, { email: true, sms: false, tags })
    notes.push(`✉️ Invitación automática "${w.title}" (${tags.join(", ")}): ${r.emailSent} correos`)
  }
  return notes
}
