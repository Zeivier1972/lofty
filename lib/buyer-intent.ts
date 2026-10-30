import { prisma } from "@/lib/prisma"

/**
 * Buy-now intent: who in the database is acting like a buyer *right now*.
 *
 * `leadScore` mixes all-time activity, status bonuses and increments that
 * overwrite each other, so it can't answer "who should Catherine call today".
 * This looks only at recent behaviour, the way a top agent reads a lead:
 * homes saved and re-viewed this fortnight, a saved search, clicks on the
 * listing emails, a reply this week, and a stated timeline of a few months.
 * Every point comes with a plain-language reason so the briefing and the call
 * task can say *why* someone is hot, and Sofía's message can reference it.
 */

const DAY = 24 * 3600 * 1000
const BEHAVIOUR_WINDOW_DAYS = 14
const REPLY_WINDOW_DAYS = 7
const STATED_INTENT_WINDOW_DAYS = 60

export const HOT_THRESHOLD = 35
export const WARM_THRESHOLD = 15

/** Pipeline stages where a lead is finished (won, lost or not a buyer). */
const CLOSED_STAGES = ["Won", "Closed", "Lost", "Bad Leads", "Do Not Contact", "Unqualified", "Realtor", "Churned"]

/** "En los próximos 3 meses", "0-3 months", "lo antes posible"… in form answers and notes. */
const URGENT_TIMELINE = /(pr[oó]xim[oa]s?\s+(1|2|3|uno|dos|tres)\s+mes|en\s+(1|2|3|uno|dos|tres)\s+mes|\b0\s*[-–a]\s*3\s*mes|inmediat|ya mismo|lo antes posible|cuanto antes|este mes|next\s+(1|2|3|three)\s+months?|\b0\s*[-–]\s*3\s*months?|within\s+(1|2|3|three)\s+months?|asap|right away|this month|ready (to buy )?now)/i
const BUYING_POWER = /(pre-?aprobad[oa]s?\s*[:\-]?\s*(s[ií]|yes)|pre-?approved\s*[:\-]?\s*(s[ií]|yes)|\bcontado\b|\bcash\b|pago de contado)/i

export type IntentLevel = "HOT" | "WARM" | "COLD"

export type BuyerIntent = {
  contactId: string
  firstName: string
  lastName: string
  phone: string | null
  email: string | null
  points: number
  level: IntentLevel
  reasons: string[]
  /** Short phrase Sofía and Catherine can open with ("las casas que guardaste en Doral"). */
  hook: string
  upcomingAppointment: Date | null
  canText: boolean
  canEmail: boolean
  canCall: boolean
}

function levelOf(points: number): IntentLevel {
  return points >= HOT_THRESHOLD ? "HOT" : points >= WARM_THRESHOLD ? "WARM" : "COLD"
}

type Acc = { points: number; reasons: string[]; hook?: string }

/**
 * Score every contact with a recent signal. Returns only WARM and HOT leads
 * that are still open (not archived, not in a closed stage), hottest first.
 */
export async function computeBuyerIntent(now: Date = new Date()): Promise<BuyerIntent[]> {
  const behaviourSince = new Date(now.getTime() - BEHAVIOUR_WINDOW_DAYS * DAY)
  const replySince = new Date(now.getTime() - REPLY_WINDOW_DAYS * DAY)
  const statedSince = new Date(now.getTime() - STATED_INTENT_WINDOW_DAYS * DAY)

  const [saves, views, searches, clicks, sms, wa, fb, mail, notes, timelines] = await Promise.all([
    prisma.propertySave.findMany({
      where: { isActive: true, createdAt: { gte: behaviourSince } },
      select: { contactId: true, property: { select: { city: true } } },
    }),
    prisma.propertyView.findMany({
      where: { contactId: { not: null }, createdAt: { gte: behaviourSince } },
      select: { contactId: true, propertyId: true, property: { select: { address: true, city: true } } },
    }),
    prisma.savedSearch.findMany({
      where: { isActive: true, createdAt: { gte: behaviourSince } },
      select: { contactId: true, city: true, label: true },
    }),
    prisma.activity.groupBy({
      by: ["contactId"],
      where: { type: "EMAIL_CLICK", contactId: { not: null }, createdAt: { gte: behaviourSince } },
      _count: { _all: true },
    }),
    prisma.sMSMessage.findMany({ where: { direction: "INBOUND", contactId: { not: null }, createdAt: { gte: replySince } }, select: { contactId: true }, distinct: ["contactId"] }),
    prisma.whatsAppMessage.findMany({ where: { direction: "INBOUND", contactId: { not: null }, createdAt: { gte: replySince } }, select: { contactId: true }, distinct: ["contactId"] }),
    prisma.facebookMessage.findMany({ where: { direction: "INBOUND", contactId: { not: null }, createdAt: { gte: replySince } }, select: { contactId: true }, distinct: ["contactId"] }),
    prisma.email.findMany({ where: { direction: "INBOUND", contactId: { not: null }, createdAt: { gte: replySince } }, select: { contactId: true }, distinct: ["contactId"] }),
    prisma.note.findMany({ where: { createdAt: { gte: statedSince } }, select: { contactId: true, content: true } }),
    prisma.contact.findMany({ where: { buyerTimelineMonths: { lte: 3, gte: 0 } }, select: { id: true } }),
  ])

  const acc = new Map<string, Acc>()
  const get = (id: string) => {
    let a = acc.get(id)
    if (!a) { a = { points: 0, reasons: [] }; acc.set(id, a) }
    return a
  }

  // Saved homes — the strongest on-site signal.
  const savesBy = new Map<string, { n: number; city?: string | null }>()
  for (const s of saves) {
    const v = savesBy.get(s.contactId) || { n: 0, city: s.property?.city }
    v.n++
    savesBy.set(s.contactId, v)
  }
  for (const [id, v] of Array.from(savesBy)) {
    const a = get(id)
    a.points += Math.min(v.n * 12, 36)
    a.reasons.push(`guardó ${v.n} ${v.n === 1 ? "casa" : "casas"}${v.city ? ` en ${v.city}` : ""}`)
    a.hook = `las casas que guardaste${v.city ? ` en ${v.city}` : ""}`
  }

  // Views, and coming back to the same home — people re-open the one they want.
  const viewsBy = new Map<string, { n: number; perProp: Map<string, { n: number; label: string }> }>()
  for (const v of views) {
    const id = v.contactId as string
    const e = viewsBy.get(id) || { n: 0, perProp: new Map() }
    e.n++
    const p = e.perProp.get(v.propertyId) || { n: 0, label: v.property?.address || v.property?.city || "una casa" }
    p.n++
    e.perProp.set(v.propertyId, p)
    viewsBy.set(id, e)
  }
  for (const [id, e] of Array.from(viewsBy)) {
    const a = get(id)
    a.points += Math.min(e.n * 3, 18)
    a.reasons.push(`vio ${e.n} ${e.n === 1 ? "propiedad" : "propiedades"}`)
    const repeat = Array.from(e.perProp.values()).sort((x, y) => y.n - x.n)[0]
    if (repeat && repeat.n >= 2) {
      a.points += 15
      a.reasons.push(`volvió ${repeat.n} veces a ${repeat.label}`)
      a.hook = a.hook || `${repeat.label}, que has visto varias veces`
    }
  }

  for (const s of searches) {
    const a = get(s.contactId)
    a.points += 12
    a.reasons.push(`guardó una búsqueda${s.city ? ` en ${s.city}` : ""}`)
    a.hook = a.hook || `tu búsqueda${s.city ? ` en ${s.city}` : ""}`
  }

  for (const c of clicks) {
    if (!c.contactId) continue
    const a = get(c.contactId)
    a.points += Math.min(c._count._all * 5, 15)
    a.reasons.push(`abrió ${c._count._all} ${c._count._all === 1 ? "enlace" : "enlaces"} de los correos`)
  }

  const replied = new Set<string>([...sms, ...wa, ...fb, ...mail].map(r => r.contactId as string))
  for (const id of Array.from(replied)) {
    const a = get(id)
    a.points += 25
    a.reasons.push("respondió esta semana")
  }

  const urgent = new Set<string>(timelines.map(t => t.id))
  const power = new Set<string>()
  for (const n of notes) {
    if (URGENT_TIMELINE.test(n.content)) urgent.add(n.contactId)
    if (BUYING_POWER.test(n.content)) power.add(n.contactId)
  }
  for (const id of Array.from(urgent)) {
    const a = get(id)
    a.points += 25
    a.reasons.push("dijo que quiere comprar en los próximos meses")
  }
  for (const id of Array.from(power)) {
    const a = get(id)
    a.points += 10
    a.reasons.push("pre-aprobado o compra de contado")
  }

  const candidateIds = Array.from(acc.entries()).filter(([, a]) => a.points >= WARM_THRESHOLD).map(([id]) => id)
  if (!candidateIds.length) return []

  const contacts = await prisma.contact.findMany({
    where: {
      id: { in: candidateIds },
      isArchived: false,
      NOT: { pipelineLeads: { some: { stage: { name: { in: CLOSED_STAGES } } } } },
    },
    select: {
      id: true, firstName: true, lastName: true, phone: true, email: true,
      doNotText: true, doNotEmail: true, doNotCall: true,
      appointments: {
        where: { status: "SCHEDULED", startTime: { gte: now } },
        orderBy: { startTime: "asc" },
        take: 1,
        select: { startTime: true },
      },
    },
  })

  return contacts
    .map(c => {
      const a = acc.get(c.id)!
      return {
        contactId: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        email: c.email,
        points: a.points,
        level: levelOf(a.points),
        reasons: a.reasons,
        hook: a.hook || "tu búsqueda de casa",
        upcomingAppointment: c.appointments[0]?.startTime || null,
        canText: !!c.phone && !c.doNotText,
        canEmail: !!c.email && !c.doNotEmail,
        canCall: !!c.phone && !c.doNotCall,
      }
    })
    .sort((x, y) => y.points - x.points)
}
