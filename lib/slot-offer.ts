import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { sendSMS } from "@/lib/sms"
import { isAssignedToPartner } from "@/lib/referral"
import { handleAppointmentBooked } from "@/lib/lead-flow"
import { AGENT_TZ, easternWallTime, formatEastern } from "@/lib/eastern-time"

/**
 * "¿Te queda mejor mañana a las 11 am o el martes a las 3 pm? Responde 1 o 2."
 *
 * Two concrete times book far more calls than a link: answering "2" is easier
 * than opening a calendar. Sofía offers the next two open slots from
 * Catherine's availability, remembers the offer, and when the lead answers
 * 1 / 2 (or names one of the times) the call is booked on the spot — same
 * appointment, task and confirmations as the /book page.
 */

const DEFAULT_START = "09:00"
const DEFAULT_END = "18:00"
/** No offering a slot sooner than this — Catherine needs time to see it. */
const MIN_LEAD_MS = 3 * 3600 * 1000
const LOOKAHEAD_DAYS = 7
/** An answer counts for this long after the offer. */
const OFFER_TTL_MS = 72 * 3600 * 1000

function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + m
}
function toTime(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
}

/** Open slots ("HH:MM", Miami time) on a date — the same rules as /api/appointments/slots. */
export async function getOpenSlots(dateStr: string, userId?: string | null): Promise<{ slots: string[]; slotMinutes: number; message?: string }> {
  const dayOfWeek = new Date(dateStr + "T00:00:00Z").getUTCDay()
  const avail = userId
    ? await prisma.availability.findFirst({ where: { userId, dayOfWeek } })
    : await prisma.availability.findFirst({ where: { dayOfWeek } })

  if (avail && avail.isAvailable === false) return { slots: [], slotMinutes: 30, message: "No disponible este día" }
  // No record: Mon–Sat 9am–6pm; Sunday closed.
  if (!avail && dayOfWeek === 0) return { slots: [], slotMinutes: 30, message: "No disponible este día" }
  const eff = avail ?? { startTime: DEFAULT_START, endTime: DEFAULT_END, slotMinutes: 30 }

  const blocks = await prisma.availabilityBlock.findMany({ where: { date: dateStr, ...(userId && { userId }) } })
  if (blocks.some(b => !b.startTime)) return { slots: [], slotMinutes: eff.slotMinutes || 30, message: "Día bloqueado" }

  const booked = await prisma.appointment.findMany({
    where: {
      startTime: { gte: easternWallTime(dateStr, "00:00"), lte: easternWallTime(dateStr, "23:59", "59") },
      status: { not: "CANCELLED" },
      ...(userId && { userId }),
    },
    select: { startTime: true, endTime: true },
  })

  const slotMins = eff.slotMinutes || 30
  const slots: string[] = []
  for (let m = toMin(eff.startTime); m + slotMins <= toMin(eff.endTime); m += slotMins) {
    if (blocks.some(b => b.startTime && b.endTime && m < toMin(b.endTime) && m + slotMins > toMin(b.startTime))) continue
    const s = easternWallTime(dateStr, toTime(m))
    const e = easternWallTime(dateStr, toTime(m + slotMins))
    if (booked.some(a => s < a.endTime && e > a.startTime)) continue
    if (s <= new Date()) continue
    slots.push(toTime(m))
  }
  return { slots, slotMinutes: slotMins }
}

export type OfferedSlot = { start: string; label: string }

/** "mañana a las 11:00 a. m." / "el martes 4 a las 3:00 p. m." in Miami time. */
function slotLabel(d: Date, now: Date): string {
  const day = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: AGENT_TZ })
  const tomorrow = new Date(now.getTime() + 86400000)
  const hour = d.toLocaleTimeString("es-US", { timeZone: AGENT_TZ, hour: "numeric", minute: "2-digit" })
  if (day(d) === day(now)) return `hoy a las ${hour}`
  if (day(d) === day(tomorrow)) return `mañana a las ${hour}`
  const wd = d.toLocaleDateString("es-US", { timeZone: AGENT_TZ, weekday: "long", day: "numeric" })
  return `el ${wd} a las ${hour}`
}

/**
 * The next two times worth offering: the soonest open slot (at least 3 h out),
 * and one on another day at the other half of the day, so the lead gets a real
 * choice (tomorrow morning vs. the next afternoon) instead of 10:00 vs 10:30.
 */
export async function pickTwoTimes(now: Date = new Date()): Promise<OfferedSlot[]> {
  const all: Date[] = []
  for (let i = 0; i < LOOKAHEAD_DAYS && all.length < 40; i++) {
    const dateStr = new Date(now.getTime() + i * 86400000).toLocaleDateString("en-CA", { timeZone: AGENT_TZ })
    const { slots } = await getOpenSlots(dateStr).catch(() => ({ slots: [] as string[] }))
    for (const t of slots) {
      const d = easternWallTime(dateStr, t)
      if (d.getTime() >= now.getTime() + MIN_LEAD_MS) all.push(d)
    }
  }
  if (!all.length) return []
  const day = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: AGENT_TZ })
  const isAfternoon = (x: Date) => Number(x.toLocaleString("en-US", { timeZone: AGENT_TZ, hour: "numeric", hour12: false })) >= 13
  const first = all[0]
  const second =
    all.find(d => day(d) !== day(first) && isAfternoon(d) !== isAfternoon(first)) ||
    all.find(d => day(d) !== day(first)) ||
    all.find(d => d.getTime() - first.getTime() >= 2 * 3600 * 1000)
  return [first, second].filter(Boolean).map(d => ({ start: d!.toISOString(), label: slotLabel(d!, now) }))
}

/** The question to put in a message. Empty when there's nothing to offer. */
export function offerQuestion(slots: OfferedSlot[]): string {
  if (slots.length >= 2) return `¿Te queda mejor ${slots[0].label} (responde 1) o ${slots[1].label} (responde 2)?`
  if (slots.length === 1) return `¿Te queda bien ${slots[0].label}? Responde 1 para confirmar.`
  return ""
}

/** Remember what was offered so a "1" / "2" reply can be booked. */
export async function recordOffer(contactId: string, slots: OfferedSlot[]): Promise<void> {
  if (!slots.length) return
  await prisma.activity.create({
    data: {
      type: "SLOT_OFFER",
      title: "Sofía ofreció horarios para llamar con Catherine",
      description: slots.map((s, i) => `${i + 1}) ${s.label}`).join(" · "),
      contactId,
      metadata: JSON.stringify({ slots }),
    },
  }).catch(() => {})
}

/** Offer two times: returns the question and records the offer. */
export async function makeOffer(contactId: string): Promise<string> {
  const slots = await pickTwoTimes().catch(() => [] as OfferedSlot[])
  await recordOffer(contactId, slots)
  return offerQuestion(slots)
}

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w\s:]/g, " ").replace(/\s+/g, " ").trim()
}

/**
 * Which offered slot does this reply pick, if any? Conservative on purpose:
 * a clear "1"/"2"/"la primera"/"la segunda", or an hour that matches exactly
 * one offered slot. Anything else returns null and the normal AI reply runs.
 */
export function pickFromReply(text: string, slots: OfferedSlot[]): OfferedSlot | null {
  const t = norm(text)
  if (!t || t.length > 80) return null
  if (/^(opcion\s*)?(1|uno|la primera|primera|el primero|primero)(\s.*)?$/.test(t) && !/^1\d/.test(t)) return slots[0] || null
  if (/^(opcion\s*)?(2|dos|la segunda|segunda|el segundo|segundo)(\s.*)?$/.test(t) && !/^2\d/.test(t)) return slots[1] || null
  // "a las 3", "3pm", "11 am", "las 11:00" — only when it reads like a time,
  // so "tengo 2 hijos" never books anything.
  const m = t.match(/\b(?:a las|las)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|a m|p m)?\b/) ||
    t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a m|p m)\b/) ||
    t.match(/\b(\d{1,2}):(\d{2})()\b/)
  if (!m) return null
  let h = Number(m[1])
  if (h < 1 || h > 23) return null
  const pm = m[3]?.startsWith("p")
  if (pm && h < 12) h += 12
  const hits = slots.filter(s => {
    const sh = Number(new Date(s.start).toLocaleString("en-US", { timeZone: AGENT_TZ, hour: "numeric", hour12: false }))
    return sh === h || (!m[3] && sh === h + 12)
  })
  return hits.length === 1 ? hits[0] : null
}

/** The open offer for this contact (most recent, within 72 h, not yet booked), if any. */
export async function openOffer(contactId: string): Promise<OfferedSlot[] | null> {
  const offer = await prisma.activity.findFirst({
    where: { contactId, type: "SLOT_OFFER", createdAt: { gte: new Date(Date.now() - OFFER_TTL_MS) } },
    orderBy: { createdAt: "desc" },
    select: { metadata: true, createdAt: true },
  })
  if (!offer?.metadata) return null
  const booked = await prisma.activity.findFirst({
    where: { contactId, type: "APPOINTMENT_SCHEDULED", createdAt: { gte: offer.createdAt } },
    select: { id: true },
  })
  if (booked) return null
  try {
    const slots = JSON.parse(offer.metadata).slots as OfferedSlot[]
    return Array.isArray(slots) && slots.length ? slots : null
  } catch { return null }
}

/**
 * Book the call for a contact at `start` — the same records the /book page
 * makes (appointment, activity, task, notification, emails/texts to Catherine)
 * plus the post-booking flow. Returns null if the slot was taken meanwhile.
 */
export async function bookCallForContact(contactId: string, start: Date, channel: string): Promise<{ appointmentId: string } | null> {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { id: true, firstName: true, lastName: true, phone: true, email: true },
  })
  if (!contact) return null

  const dateStr = start.toLocaleDateString("en-CA", { timeZone: AGENT_TZ })
  const hhmm = start.toLocaleTimeString("en-GB", { timeZone: AGENT_TZ, hour: "2-digit", minute: "2-digit" })
  const { slots, slotMinutes } = await getOpenSlots(dateStr)
  if (!slots.includes(hhmm)) return null

  const agent = await prisma.user.findFirst({ where: { isActive: true }, select: { id: true } })
  const cfg = await prisma.aIConfig.findFirst({ select: { realtorEmail: true, realtorPhone: true, realtorName: true } }).catch(() => null)
  const name = `${contact.firstName} ${contact.lastName || ""}`.trim()
  const when = formatEastern(start)

  const appointment = await prisma.appointment.create({
    data: {
      title: `Llamada con Catherine — ${name}`,
      description: `Agendada por ${channel} respondiendo a los horarios que ofreció Sofía.`,
      startTime: start,
      endTime: new Date(start.getTime() + slotMinutes * 60000),
      type: "BUYER_CONSULTATION",
      status: "SCHEDULED",
      location: "Teléfono",
      contactId,
      ...(agent && { userId: agent.id }),
    },
  })

  await prisma.activity.create({
    data: {
      type: "APPOINTMENT_SCHEDULED",
      title: "Cita agendada por mensaje",
      description: `${name} eligió ${when} respondiendo a Sofía por ${channel}`,
      contactId,
      ...(agent && { userId: agent.id }),
    },
  })

  if (!(await isAssignedToPartner(contactId).catch(() => false))) {
    await prisma.task.create({
      data: {
        title: `Llamada con ${name} — ${when}`,
        description: `Agendada por ${channel} (eligió uno de los horarios que ofreció Sofía).${contact.phone ? `\nTel: ${contact.phone}` : ""}`,
        priority: "HIGH",
        type: "APPOINTMENT",
        contactId,
        dueDate: start,
        ...(agent && { assignedToId: agent.id }),
      },
    })
  }

  await prisma.aINotification.create({
    data: {
      type: "APPOINTMENT_REQUEST",
      title: `📅 ${name} agendó una llamada`,
      body: `${when} — eligió el horario por ${channel}.`,
      priority: "HIGH",
      contactId,
    },
  }).catch(() => {})

  if (cfg?.realtorPhone) {
    sendSMS(cfg.realtorPhone, `📅 Nueva cita: ${name} — ${when}. Agendada por ${channel}${contact.phone ? ` · ${contact.phone}` : ""}`).catch(() => {})
  }
  if (cfg?.realtorEmail) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.catherinegomezrealtor.com"
    sendEmail({
      to: cfg.realtorEmail,
      transactional: true,
      subject: `📅 Nueva cita: ${name} — ${when}`,
      html: `<p>${name} eligió <strong>${when}</strong> respondiendo a Sofía por ${channel}.</p>${contact.phone ? `<p>Tel: ${contact.phone}</p>` : ""}<p><a href="${appUrl}/contacts/${contactId}">Ver contacto en el CRM →</a></p>`,
    }).catch(() => {})
  }

  await handleAppointmentBooked(contactId).catch(e => console.error("[slot-offer] post-booking flow failed:", e))
  return { appointmentId: appointment.id }
}

/**
 * Handle an inbound reply against an open offer. Returns the text to send
 * back, or null when the reply isn't an answer to the offer (the caller then
 * carries on with its normal reply).
 */
export async function handleSlotReply(contactId: string, text: string, channel: string): Promise<string | null> {
  const slots = await openOffer(contactId)
  if (!slots) return null
  const chosen = pickFromReply(text, slots)
  if (!chosen) return null

  const contact = await prisma.contact.findUnique({ where: { id: contactId }, select: { firstName: true } })
  const cfg = await prisma.aIConfig.findFirst({ select: { realtorName: true } }).catch(() => null)
  const agentName = (cfg?.realtorName || "Catherine").split(" ")[0]

  const booked = await bookCallForContact(contactId, new Date(chosen.start), channel)
  if (booked) {
    return `Listo ${contact?.firstName || ""}! Quedo agendada tu llamada con ${agentName} ${chosen.label} (hora de Miami). Ella te llamara a este numero. Si necesitas cambiarla, respondeme aqui.`
  }
  // Taken in the meantime — offer fresh times.
  const again = await makeOffer(contactId)
  return again
    ? `Uy, ese horario se acaba de ocupar. ${again}`
    : `Uy, ese horario se acaba de ocupar. ${agentName} te escribira para coordinar otra hora.`
}
