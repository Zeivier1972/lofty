import { prisma } from "@/lib/prisma"
import { sendEmail, wrapEmail } from "@/lib/email"
import { ingestLead, applyTagAndEnroll } from "@/lib/lead-ingest"

/**
 * Keyword auto-replies for inbound email ("reply BOO to get the link").
 *
 * An email blast tells people to reply with a word; Resend's inbound webhook
 * (/api/inbound/email) hands each reply here. Add a row to KEYWORDS for the
 * next campaign — nothing else needs to change.
 */

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.catherinegomezrealtor.com"

type EmailKeyword = {
  /** Matched as a whole word, case-insensitive, against the reply's own text only. */
  word: RegExp
  /** Applied to the contact so the campaign's responders can be filtered and nurtured. */
  tag: string
  subject: string
  heading: string
  intro: string
  linkLabel: string
  url: string
}

const KEYWORDS: EmailKeyword[] = [
  {
    word: /\bb+o{2,}\b/i, // BOO, boo, Booo…
    tag: "Halloween BOO",
    subject: "🎃 ¡BOO! Aquí está tu link de preconstrucción",
    heading: "¡BOO! 🎃 Aquí lo tienes",
    intro: "Gracias por responder. Estos son los proyectos de preconstrucción en Miami y Orlando que estamos recomendando ahora, con precios y planes de pago:",
    linkLabel: "Ver proyectos de preconstrucción →",
    url: `${BASE}/proyectos`,
  },
]

/** Don't answer the same person twice for the same word within this window. */
const REPEAT_WINDOW_MS = 7 * 24 * 3600 * 1000

/**
 * The reply's own words, without the quoted original underneath. The blast
 * itself says "reply BOO", so matching the quoted part would answer everyone
 * who replies anything at all.
 */
export function replyOnly(text: string): string {
  const lines = text.replace(/\r/g, "").split("\n")
  const out: string[] = []
  for (const line of lines) {
    const t = line.trim()
    if (t.startsWith(">")) break
    if (/^(on .+ wrote:|el .+ escribi[oó]:|-{2,}\s*original message|-{2,}\s*mensaje original|from:\s|de:\s|sent from my|enviado desde mi)/i.test(t)) break
    out.push(line)
  }
  return out.join("\n").slice(0, 2000)
}

/**
 * Handle a keyword reply. Returns the keyword's tag when it matched and the
 * auto-reply went out (or had already gone out recently), else null.
 */
export async function handleEmailKeywordReply(opts: {
  fromEmail: string
  fromName?: string
  text: string
  contactId: string | null
}): Promise<string | null> {
  const own = replyOnly(opts.text)
  const kw = KEYWORDS.find(k => k.word.test(own))
  if (!kw) return null

  // Already answered recently → don't send again (people reply twice, and
  // mail clients sometimes deliver the same reply twice).
  const since = new Date(Date.now() - REPEAT_WINDOW_MS)
  const already = await prisma.email.findFirst({
    where: { direction: "OUTBOUND", toAddress: opts.fromEmail, subject: kw.subject, createdAt: { gte: since } },
    select: { id: true },
  }).catch(() => null)
  if (already) return kw.tag

  // Make sure the person is a contact, tagged for this campaign.
  let contactId = opts.contactId
  if (!contactId) {
    const [first, ...rest] = (opts.fromName || opts.fromEmail.split("@")[0]).trim().split(/\s+/)
    const r = await ingestLead({
      firstName: first || "Email",
      lastName: rest.join(" "),
      email: opts.fromEmail,
      source: "EMAIL",
      campaign: kw.tag,
      tags: [kw.tag],
      // They get the link below — the generic welcome on top would be noise.
      skipWelcome: true,
    })
    contactId = r.contactId
  } else {
    await applyTagAndEnroll(contactId, kw.tag).catch(() => {})
  }

  const cfg = await prisma.aIConfig.findFirst({
    select: { realtorName: true, realtorPhone: true, calendlyUrl: true },
  }).catch(() => null)
  const contact = await prisma.contact.findUnique({ where: { id: contactId }, select: { firstName: true } })
  const first = contact?.firstName && contact.firstName !== "Email" ? contact.firstName : ""
  const book = cfg?.calendlyUrl || `${BASE}/book`

  const html = wrapEmail(`
    <h2 style="color:#111827;margin:0 0 10px">${kw.heading}</h2>
    <p style="color:#374151;margin:0 0 18px">${first ? `Hola ${first}, g` : "G"}${kw.intro.slice(1)}</p>
    <div style="text-align:center;margin:22px 0">
      <a href="${kw.url}" style="display:inline-block;background:#0e1f3d;color:#fff;padding:14px 30px;border-radius:10px;text-decoration:none;font-weight:700">${kw.linkLabel}</a>
    </div>
    <p style="color:#374151;margin:0 0 6px">¿Quieres que veamos cuál te conviene? Agenda una llamada de 20 minutos:</p>
    <p style="margin:0"><a href="${book}" style="color:#0e1f3d;font-weight:700">${book}</a></p>
  `, { agentName: cfg?.realtorName || "Catherine Gomez", agentPhone: cfg?.realtorPhone || undefined })

  const ok = await sendEmail({ to: opts.fromEmail, subject: kw.subject, html })
  if (!ok) {
    console.error(`[email-keyword] ${kw.tag}: auto-reply to ${opts.fromEmail} failed`)
    return null
  }

  await Promise.all([
    prisma.email.create({
      data: {
        subject: kw.subject, body: html, fromAddress: process.env.RESEND_FROM || "", toAddress: opts.fromEmail,
        direction: "OUTBOUND", status: "SENT", sentAt: new Date(), contactId,
      },
    }),
    prisma.activity.create({
      data: { type: "EMAIL_SENT", title: `Respondió "${kw.tag}" — se le envió el link automáticamente`, contactId },
    }),
    prisma.aINotification.create({
      data: {
        type: "EMAIL_KEYWORD",
        title: `🎃 ${first || opts.fromEmail} respondió ${kw.tag}`,
        body: `Se le envió el link (${kw.url}) automáticamente. Buen momento para darle seguimiento.`,
        priority: "HIGH",
        contactId,
      },
    }),
  ]).catch(e => console.error("[email-keyword] logging failed:", e))

  console.log(`[email-keyword] ${kw.tag}: link sent to ${opts.fromEmail}`)
  return kw.tag
}
