import { prisma } from "@/lib/prisma"
import { sendBulkEmail, wrapEmail } from "@/lib/email"
import { sendSMS, toE164 } from "@/lib/sms"
import { localZoneFor, whenFor } from "@/lib/appointment-message"

/**
 * Inviting the CRM's own book to a webinar — everyone, or only the contacts
 * carrying some tags ("Domus", "Colombia"…). Shared by the Invitar button and
 * by the weekly series, which emails its tags on its own two days before.
 */

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.catherinegomezrealtor.com"

const whenMiami = (d: Date) =>
  new Intl.DateTimeFormat("es-US", {
    timeZone: "America/New_York", weekday: "long", day: "numeric", month: "long",
    hour: "numeric", minute: "2-digit", hour12: true,
  }).format(d)

/** "; jueves 6:00 p. m. en Colombia" for a contact abroad; "" otherwise. */
function localNote(start: Date, phone: string | null): string {
  const z = localZoneFor(phone)
  if (!z) return ""
  return `; ${start.toLocaleString("es-US", { timeZone: z.tz, weekday: "long", hour: "numeric", minute: "2-digit" })} en ${z.country}`
}

/** Tag names from a body/query/DB value; [] means "the whole list". */
export function parseTags(raw: unknown): string[] {
  let v: unknown = raw
  if (typeof raw === "string") {
    try { v = JSON.parse(raw) } catch { v = raw.split(",") }
  }
  if (!Array.isArray(v)) return []
  return Array.from(new Set(v.map(x => String(x).trim()).filter(Boolean))).slice(0, 30)
}

/**
 * Who an invitation would reach. Archived contacts and email opt-outs are
 * out, and so is anyone already registered for THIS session. With tags, only
 * contacts carrying at least one of them.
 */
export async function inviteAudience(webinarId: string, tags: string[]) {
  const registered = await prisma.webinarRegistration.findMany({
    where: { webinarId, contactId: { not: null } },
    select: { contactId: true },
  })
  const skip = registered.map(r => r.contactId!).filter(Boolean)

  const emailable = await prisma.contact.findMany({
    where: {
      isArchived: false,
      doNotEmail: false,
      email: { not: null },
      ...(skip.length ? { id: { notIn: skip } } : {}),
      ...(tags.length ? { tags: { some: { tag: { name: { in: tags } } } } } : {}),
    },
    select: { id: true, firstName: true, email: true, phone: true, doNotText: true, smsTCPAConsent: true },
  })
  // Texting is its own permission; sendSMS checks it again per message.
  const textable = emailable.filter(c => c.phone && !c.doNotText && c.smsTCPAConsent)
  return { emailable, textable, alreadyRegistered: skip.length }
}

export async function sendWebinarInvite(
  webinarId: string,
  opts: { email: boolean; sms: boolean; tags: string[] },
): Promise<{ emailSent: number; smsSent: number }> {
  const webinar = await prisma.webinar.findUnique({
    where: { id: webinarId },
    select: { id: true, slug: true, title: true, description: true, startsAt: true },
  })
  if (!webinar) return { emailSent: 0, smsSent: 0 }

  const { emailable, textable } = await inviteAudience(webinarId, opts.tags)
  const pageUrl = `${BASE}/webinar/${webinar.slug}`
  const when = whenMiami(webinar.startsAt)

  // Stamped BEFORE sending: if the request dies partway, a retry must not
  // mail everyone who already got it a second time.
  await prisma.webinar.update({
    where: { id: webinarId },
    data: { invitedAt: new Date(), invitedCount: 0, invitedTags: JSON.stringify(opts.tags) },
  })

  let emailSent = 0
  let smsSent = 0

  if (opts.email && emailable.length) {
    const html = wrapEmail(
      `<p style="color:#334155;line-height:1.7">Hola {first_name},</p>
       <p style="color:#334155;line-height:1.7">
         <strong style="text-transform:capitalize">${when}</strong> (hora de Miami{local_note}) voy a hacer algo que
         normalmente solo hago en cita privada: abrir los números completos de un proyecto, en vivo,
         y responder lo que me pregunten.
       </p>
       <p style="color:#334155;line-height:1.7">${webinar.description}</p>
       <p style="text-align:center;margin:28px 0">
         <a href="${pageUrl}" style="background:#0369a1;color:#fff;padding:14px 32px;border-radius:50px;text-decoration:none;font-weight:bold;display:inline-block">Guardar mi lugar</a>
       </p>
       <p style="color:#334155;line-height:1.7">
         Es gratis, es en español y no tiene ningún compromiso: la idea es que conozcas el proyecto
         y preguntes lo que quieras en vivo.
       </p>`,
      { agentName: "Catherine Gomez", unsubscribeUrl: "{unsubscribe_url}" },
    )
    const res = await sendBulkEmail(
      emailable.map(c => ({
        to: c.email!,
        vars: { first_name: c.firstName, local_note: localNote(webinar.startsAt, c.phone), unsubscribe_url: `${BASE}/api/unsubscribe?id=${c.id}` },
      })),
      { subject: `${webinar.title} — en vivo ${when}`, html },
      50,
      1000,
    ).catch(() => ({ sent: 0, failed: emailable.length }))
    emailSent = res.sent
  }

  if (opts.sms && textable.length) {
    // One at a time: sendSMS carries the do-not-text guard, dedupe and cap.
    for (const c of textable) {
      const sid = await sendSMS(
        toE164(c.phone!),
        `${c.firstName}, soy Catherine. El ${whenFor(webinar.startsAt, c.phone)} presento en vivo un proyecto en Miami y respondo preguntas. Gratis, en espanol y sin compromiso: ${pageUrl}`,
        undefined,
        { automated: true, contactId: c.id },
      ).catch(() => null)
      if (sid) smsSent++
    }
  }

  await prisma.webinar.update({ where: { id: webinarId }, data: { invitedCount: emailSent + smsSent } })
  return { emailSent, smsSent }
}
