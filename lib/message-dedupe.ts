import { prisma } from "@/lib/prisma"

/**
 * Stop the same automated message reaching the same person twice.
 *
 * The existing cooldown in sendSMS is a blanket "one automated text per ~20h",
 * which is a volume limit, not a repetition check: it cannot tell a useful
 * follow-up from the identical sentence sent again, and it only ever looks at
 * SMSMessage. Three gaps let a lead receive the same words twice:
 *
 *  - WHATSAPP SENDS ARE INVISIBLE TO IT. sendWhatsApp has no cooldown at all,
 *    and its sends land in WhatsAppMessage, a table the SMS check never reads.
 *    A plan that texts and WhatsApps the same copy slips straight through.
 *  - ACCENTS MAKE TWO COPIES LOOK DIFFERENT. Automated SMS is run through
 *    sanitizeSmsBody to keep it in one cheap GSM-7 segment, which strips
 *    accents, so "sales con números reales" goes out as "sales con numeros
 *    reales" while the WhatsApp copy keeps them. Byte comparison sees two
 *    different strings; the person sees the same sentence twice.
 *  - THE 20h WINDOW IS TOO SHORT for a 30-day nurture, where a repeat is more
 *    likely a week later than the same morning.
 *
 * So the comparison is on a normalised fingerprint, across both channels, over
 * a window measured in days.
 */

/** Same sentence after accents, case, links and punctuation stop mattering. */
export function fingerprint(text: string): string {
  return (text ?? "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")  // números → numeros
    // Links carry campaign params and anchors that differ between copies of the
    // same message, so they say nothing about whether the words are the same.
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * How close two messages have to be to count as the same one. Full equality is
 * too strict — a merge field like the first name, or a price edited between
 * runs, would hide a repeat — so compare on a long shared prefix of the
 * normalised text, which is what a person actually recognises.
 */
const PREFIX_CHARS = 120

/** Drop a short leading token — the merge-field first name. */
function withoutLeadingName(fp: string): string {
  const i = fp.indexOf(" ")
  if (i <= 0 || i > 16) return fp
  return fp.slice(i + 1)
}

export function looksLikeSame(a: string, b: string): boolean {
  const fa = fingerprint(a)
  const fb = fingerprint(b)
  if (!fa || !fb) return false
  if (fa === fb) return true

  const prefixMatch = (x: string, y: string) => {
    const n = Math.min(PREFIX_CHARS, x.length, y.length)
    // Short messages must match outright; a 20-character overlap means nothing.
    if (n < 40) return false
    return x.slice(0, n) === y.slice(0, n)
  }

  if (prefixMatch(fa, fb)) return true

  // The same message can lead with a different name for one person: these
  // messages open with "{first_name}," and this CRM does correct a name after
  // the fact — the Facebook m.me fallback recorded people as "INFO" until it
  // was fixed. Comparing again without that first token stops a corrected name
  // from disguising a repeat. Everything after it still has to match, so two
  // genuinely different messages do not collapse into one.
  return prefixMatch(withoutLeadingName(fa), withoutLeadingName(fb))
}

export const DEFAULT_DEDUPE_DAYS = 30

/**
 * Has this person already been sent this message, on either channel, recently?
 *
 * Matches on the contact when known and on the phone number regardless, because
 * duplicate contact rows for one person are exactly the case where a repeat
 * sneaks through.
 */
export async function wasRecentlySent(opts: {
  body: string
  contactId?: string | null
  toNumber?: string | null
  days?: number
}): Promise<{ duplicate: boolean; sentAt?: Date; channel?: "SMS" | "WHATSAPP" }> {
  const days = opts.days ?? Number(process.env.MESSAGE_DEDUPE_DAYS || DEFAULT_DEDUPE_DAYS)
  if (!opts.body?.trim() || days <= 0) return { duplicate: false }

  const since = new Date(Date.now() - days * 24 * 3600 * 1000)
  const digits10 = (opts.toNumber || "").replace(/\D/g, "").slice(-10)

  const who: any[] = []
  if (opts.contactId) who.push({ contactId: opts.contactId })
  if (digits10.length >= 7) who.push({ toNumber: { contains: digits10 } })
  if (!who.length) return { duplicate: false }

  const where = {
    direction: "OUTBOUND",
    createdAt: { gte: since },
    // A send that failed or was blocked never reached anyone, so it must not
    // suppress the retry that finally does.
    status: { notIn: ["FAILED", "UNDELIVERED", "BLOCKED"] },
    OR: who,
  }
  const select = { body: true, createdAt: true } as const
  const take = 60

  const [sms, wa] = await Promise.all([
    prisma.sMSMessage.findMany({ where, select, orderBy: { createdAt: "desc" }, take }),
    prisma.whatsAppMessage.findMany({ where, select, orderBy: { createdAt: "desc" }, take }),
  ])

  for (const m of sms) {
    if (looksLikeSame(m.body, opts.body)) return { duplicate: true, sentAt: m.createdAt, channel: "SMS" }
  }
  for (const m of wa) {
    if (looksLikeSame(m.body, opts.body)) return { duplicate: true, sentAt: m.createdAt, channel: "WHATSAPP" }
  }
  return { duplicate: false }
}
