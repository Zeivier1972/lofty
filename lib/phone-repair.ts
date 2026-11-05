import { prisma } from "@/lib/prisma"
import { toE164 } from "@/lib/sms"

/**
 * One-time repair: Colombian mobiles saved as US numbers.
 *
 * Public forms had no country picker, so "316 428 7900" became +13164287900.
 * The text failed, and the failure hook set doNotText for good. Colombian
 * mobiles are 10 digits starting 300-305, 310-324, 333, 350-353; real US area
 * codes overlap with those (305 is Miami, 313 Detroit, 316 Wichita), so the
 * digits alone are not proof. Each candidate comes with the evidence and only
 * the strong ones are pre-selected; Catherine confirms before anything changes.
 */

const CO_MOBILE = /^3(0[0-5]|1\d|2[0-4]|33|5[0-3])\d{7}$/
/** Titles the two auto-disable paths write (lib/sms.ts and the Twilio status hook). */
const AUTO_OFF_TITLES = ["🚫 SMS desactivado automáticamente", "📵 Texting apagado para este número"]
/** Tags that only international (mostly Colombian) leads get. */
const INTL_TAG = /domus|house of wellness|parkside|colombia|webinar|inversion|inversión/i

export type PhoneRepairCandidate = {
  id: string
  name: string
  email: string | null
  phone: string
  proposed: string
  doNotText: boolean
  autoDisabled: boolean
  failureCode: string | null
  tags: string[]
  source: string | null
  createdAt: string
  /** Pre-selected in the review list. */
  recommended: boolean
  why: string[]
}

export async function findPhoneRepairCandidates(): Promise<PhoneRepairCandidate[]> {
  // Phones are stored in whatever format they arrived in, so normalize in JS.
  const rows = await prisma.contact.findMany({
    where: { isArchived: false, phone: { not: null } },
    select: {
      id: true, firstName: true, lastName: true, email: true, phone: true, doNotText: true,
      source: true, createdAt: true,
      tags: { select: { tag: { select: { name: true } } } },
    },
  })

  const suspects = rows.filter(r => {
    const e = toE164(r.phone)
    return e.startsWith("+1") && e.length === 12 && CO_MOBILE.test(e.slice(2))
  })
  if (!suspects.length) return []
  const ids = suspects.map(s => s.id)

  const [autoOff, sms] = await Promise.all([
    prisma.activity.findMany({
      where: { contactId: { in: ids }, title: { in: AUTO_OFF_TITLES } },
      select: { contactId: true, description: true },
    }),
    prisma.sMSMessage.findMany({
      where: { contactId: { in: ids } },
      select: { contactId: true, direction: true, status: true },
    }),
  ])

  const out: PhoneRepairCandidate[] = []
  for (const r of suspects) {
    const e164 = toE164(r.phone)
    const ten = e164.slice(2)
    const mine = sms.filter(m => m.contactId === r.id)
    // Proof it is a working US number: a text was delivered to it, or they texted us from it.
    if (mine.some(m => m.direction === "OUTBOUND" && m.status === "DELIVERED")) continue
    if (mine.some(m => m.direction === "INBOUND")) continue

    const offs = autoOff.filter(a => a.contactId === r.id)
    // 21610 is the person replying STOP — an opt-out, never a wrong number.
    if (offs.some(a => (a.description || "").includes("21610"))) continue
    const code = offs.map(a => (a.description || "").match(/\b(2\d{4}|3\d{4})\b/)?.[1]).find(Boolean) || null
    const autoDisabled = r.doNotText && offs.length > 0
    const tags = r.tags.map(t => t.tag.name)
    const intl = tags.some(t => INTL_TAG.test(t)) || /webinar|domus|wellness|parkside|colombia/i.test(r.source || "")

    const why: string[] = []
    if (autoDisabled) why.push(`El texto falló${code ? ` (error ${code})` : ""} y se apagó el SMS`)
    if (code === "21211") why.push("Twilio dijo que no es un número válido de EE. UU.")
    if (intl) why.push("Viene de un proyecto/webinar para inversionistas internacionales")
    if (ten.startsWith("305")) why.push("Ojo: 305 también es Miami — revisar")

    // Pre-select only with two independent signals, and never a 305.
    const recommended = !ten.startsWith("305") && autoDisabled && (intl || code === "21211")
    if (!autoDisabled && !intl) continue // nothing suggests it is wrong

    out.push({
      id: r.id,
      name: [r.firstName, r.lastName].filter(Boolean).join(" ") || "(sin nombre)",
      email: r.email,
      phone: r.phone!,
      proposed: `+57${ten}`,
      doNotText: r.doNotText,
      autoDisabled,
      failureCode: code,
      tags,
      source: r.source,
      createdAt: r.createdAt.toISOString(),
      recommended,
      why,
    })
  }
  return out.sort((a, b) => Number(b.recommended) - Number(a.recommended) || b.createdAt.localeCompare(a.createdAt))
}

/** Rewrites the phone to +57 and turns texting back on only when the failure hook (not the person) turned it off. */
export async function applyPhoneRepair(ids: string[], userId?: string): Promise<number> {
  const candidates = (await findPhoneRepairCandidates()).filter(c => ids.includes(c.id))
  for (const c of candidates) {
    await prisma.contact.update({
      where: { id: c.id },
      data: { phone: c.proposed, ...(c.autoDisabled ? { doNotText: false } : {}) },
    })
    await prisma.activity.create({
      data: {
        type: "NOTE_ADDED",
        title: "📱 Teléfono corregido a Colombia (+57)",
        description: `Estaba guardado como número de EE. UU. (${c.phone}); ahora ${c.proposed}.${c.autoDisabled ? " Se volvió a activar el SMS." : ""}`,
        contactId: c.id,
        ...(userId ? { userId } : {}),
      },
    }).catch(() => {})
  }
  return candidates.length
}
