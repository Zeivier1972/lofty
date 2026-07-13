import twilio from "twilio"
import { prisma } from "@/lib/prisma"

// Normalize any stored phone to E.164 WITHOUT assuming it's a US number.
// The old pattern (`+1` + last 10 digits) silently converted international
// numbers into wrong US numbers — e.g. Colombian "573208932534" became
// +1 (320) 893-2534, a Minnesota number. Rules:
//   "+..."                    → already E.164, keep
//   10 digits                 → US/Canada national → +1XXXXXXXXXX
//   11 digits starting with 1 → US with country code → +1XXXXXXXXXX
//   11+ digits otherwise      → international WITH country code → +digits
export function toE164(phone: string | null | undefined): string {
  const raw = (phone || "").trim()
  if (!raw) return ""
  if (raw.startsWith("+")) return `+${raw.slice(1).replace(/\D/g, "")}`
  const digits = raw.replace(/\D/g, "")
  if (!digits) return ""
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  if (digits.length >= 11) return `+${digits}`
  return `+1${digits}`
}

let client: twilio.Twilio | null = null

function getClient() {
  if (!client && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  }
  return client
}

// Twilio send-error codes that are PERMANENT — the number will never receive
// an SMS, so we flag the contact doNotText and never retry. Retrying only
// burns money and hurts the account's messaging reputation. See Twilio docs:
//   21211 invalid 'To' number         21610 recipient unsubscribed (STOP)
//   21612 unreachable carrier route   21614 not a valid mobile number
//   21408 permission/geo not enabled  21265 'To' is a short code
//   21266 To == From                  21268 premium/900 number
//   30003 unreachable (device off)    30005 unknown/nonexistent number
//   30006 landline / unreachable carrier
// 30003/30004 are usually transient, but by the time they surface at
// send-time (rare) they've already been retried by Twilio — still cheap to
// keep them retryable, so we treat them as soft below.
const PERMANENT_SEND_ERRORS = new Set([
  21211, 21610, 21612, 21614, 21408, 21265, 21266, 21268, 30005, 30006,
])

// Flag every contact holding this number as do-not-text and drop a timeline
// note, so no future code path (drip, alert, stage outreach) texts it again.
async function flagNumberUndeliverable(digits10: string, reason: string) {
  if (digits10.length < 7) return
  try {
    const contacts = await prisma.contact.findMany({
      where: { doNotText: false, phone: { contains: digits10 } },
      select: { id: true },
    })
    for (const ct of contacts) {
      await prisma.contact.update({ where: { id: ct.id }, data: { doNotText: true } }).catch(() => {})
      await prisma.activity.create({
        data: {
          type: "NOTE_ADDED",
          title: "📵 Texting apagado para este número",
          description: `El número no puede recibir SMS (${reason}). No se le enviarán más textos automáticos.`,
          contactId: ct.id,
        },
      }).catch(() => {})
    }
  } catch { /* best-effort */ }
}

// Hard monthly budget guardrail for AUTOMATED texting. When this calendar
// month's estimated SMS spend reaches the cap, all further automated texts are
// held until the next month (the count resets on its own — no manual step).
// Manual agent texts are never capped. Configure the cap in Settings, or via
// env; the per-message estimate is intentionally a bit conservative so we stop
// before overshooting the real Twilio bill.
const SMS_EST_COST_PER_MSG = Number(process.env.SMS_EST_COST_PER_MSG || 0.03)
const SMS_MONTHLY_CAP_DEFAULT = Number(process.env.SMS_MONTHLY_CAP_USD || 100)

export async function smsSpendThisMonth(): Promise<{ count: number; spent: number; cap: number; over: boolean }> {
  const capRow = await prisma.setting.findUnique({ where: { key: "sms_monthly_cap_usd" } }).catch(() => null)
  const cap = capRow?.value != null && capRow.value !== "" ? Number(capRow.value) : SMS_MONTHLY_CAP_DEFAULT
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const count = await prisma.sMSMessage.count({
    where: { direction: "OUTBOUND", createdAt: { gte: monthStart }, status: { not: "BLOCKED" } },
  }).catch(() => 0)
  const spent = count * SMS_EST_COST_PER_MSG
  // cap <= 0 means "no cap"
  const over = cap > 0 && spent >= cap
  return { count, spent, cap, over }
}

// opts.automated = an automated/system SMS (drip, call-outreach, welcome).
// These obey a per-contact cooldown: at most ONE automated text per contact
// per SMS_MIN_GAP_HOURS (default 20h) — so a lead can't be blasted with a
// stack of texts when their stage advances several times or crons overlap.
// Manual sends (agent-initiated) never pass automated, so they're never held.
export async function sendSMS(
  to: string,
  body: string,
  mediaUrls?: string[],
  opts?: { automated?: boolean; contactId?: string; minGapHours?: number },
): Promise<string | null> {
  to = toE164(to) || to
  const allDigits = (to || "").replace(/\D/g, "")
  const digits10 = allDigits.slice(-10)

  // Pre-send sanity check on the number itself — reject before we ever hit
  // Twilio (avoids the 21211 "invalid To" and short-code/premium errors that
  // dominate the error report, each of which still costs an API round-trip).
  //   < 10 digits              → not a real phone number (typo / partial)
  //   5–6 digit short codes    → can't send P2P long-code SMS to a short code
  if (!to || allDigits.length < 10) {
    console.log(`[SMS SKIPPED — invalid number] "${to}": too few digits, not sending`)
    if (opts?.contactId) {
      await flagNumberUndeliverable(digits10, "número inválido")
    }
    return null
  }

  // Central do-not-text guard: if ANY contact with this number is flagged
  // (replied STOP, or the number proved undeliverable), no code path can
  // text it — every send costs money.
  try {
    if (digits10.length >= 7) {
      const blocked = await prisma.contact.findFirst({
        where: { doNotText: true, phone: { contains: digits10 } },
        select: { id: true },
      })
      if (blocked) {
        console.log(`[SMS BLOCKED — doNotText] ${to}: "${body.slice(0, 60)}"`)
        prisma.sMSMessage.create({
          data: {
            direction: "OUTBOUND", body,
            fromNumber: process.env.TWILIO_PHONE_NUMBER || "unknown",
            toNumber: to, status: "BLOCKED", contactId: blocked.id,
          },
        }).catch(() => {})
        return null
      }
    }
  } catch { /* guard is best-effort — never break sending for everyone */ }

  // Global kill switch: when the agent pauses automated texting (Settings →
  // to control cost/budget), no automated SMS goes out. Manual sends unaffected.
  if (opts?.automated) {
    try {
      const paused = await prisma.setting.findUnique({ where: { key: "sms_paused" }, select: { value: true } })
      if (paused?.value === "true") {
        console.log(`[SMS PAUSED — global kill switch] ${to}: automated send skipped`)
        return null
      }
    } catch { /* if the check fails, fall through and send */ }
  }

  // Hard monthly budget cap: once this month's estimated automated spend hits
  // the cap, hold all further automated texts. Self-resets next month.
  if (opts?.automated) {
    try {
      const { over, spent, cap } = await smsSpendThisMonth()
      if (over) {
        console.log(`[SMS BUDGET CAP] month est $${spent.toFixed(2)} ≥ $${cap} — holding automated send to ${to}`)
        // Notify the agent once per month that the cap was reached.
        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const already = await prisma.aINotification.findFirst({
          where: { type: "SMS_BUDGET_CAP", createdAt: { gte: monthStart } },
          select: { id: true },
        }).catch(() => null)
        if (!already) {
          prisma.aINotification.create({
            data: {
              type: "SMS_BUDGET_CAP",
              title: "💸 Límite mensual de textos alcanzado",
              body: `Los textos automáticos se pausaron: el gasto estimado del mes (~$${spent.toFixed(0)}) llegó al tope de $${cap}. Se reanudan solos el mes que viene, o sube el tope en Configuración.`,
              priority: "HIGH",
            },
          }).catch(() => {})
        }
        return null
      }
    } catch { /* if the check fails, fall through and send */ }
  }

  // Per-contact automated cooldown — one automated text per ~day, max.
  if (opts?.automated) {
    try {
      const gapH = opts.minGapHours ?? Number(process.env.SMS_MIN_GAP_HOURS || 20)
      const since = new Date(Date.now() - gapH * 3600 * 1000)
      const recent = await prisma.sMSMessage.findFirst({
        where: {
          direction: "OUTBOUND",
          createdAt: { gte: since },
          status: { notIn: ["FAILED", "UNDELIVERED", "BLOCKED"] }, // only real sends count
          OR: [
            ...(opts.contactId ? [{ contactId: opts.contactId }] : []),
            ...(digits10.length >= 7 ? [{ toNumber: { contains: digits10 } }] : []),
          ],
        },
        select: { id: true },
      })
      if (recent) {
        console.log(`[SMS THROTTLED] ${to}: already texted within ${gapH}h — skipping automated send`)
        return null
      }
    } catch { /* if the check fails, fall through and send */ }
  }

  const c = getClient()
  let sid: string
  if (!c) {
    console.log("[SMS MOCK] To:", to, "Body:", body, "Media:", mediaUrls)
    sid = "mock-sid"
  } else {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    try {
      const msg = await c.messages.create({
        body,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to,
        // Delivery receipts → mark failed sends + auto-flag dead numbers
        ...(appUrl ? { statusCallback: `${appUrl}/api/twilio/sms-status` } : {}),
        ...(mediaUrls?.length ? { mediaUrl: mediaUrls } : {}),
      })
      sid = msg.sid
    } catch (err: any) {
      // Twilio rejected the send synchronously. On a PERMANENT error the number
      // will never work → flag doNotText so we never spend on it again. On a
      // transient error just log FAILED and let the caller move on.
      const code = Number(err?.code) || 0
      const permanent = PERMANENT_SEND_ERRORS.has(code)
      console.log(`[SMS FAILED] ${to}: code=${code} ${permanent ? "(permanent → doNotText)" : "(transient)"} — ${err?.message || err}`)
      prisma.sMSMessage.create({
        data: {
          direction: "OUTBOUND", body,
          fromNumber: process.env.TWILIO_PHONE_NUMBER || "unknown",
          toNumber: to, status: permanent ? "FAILED" : "UNDELIVERED",
          ...(opts?.contactId ? { contactId: opts.contactId } : {}),
        },
      }).catch(() => {})
      if (permanent) await flagNumberUndeliverable(digits10, `error ${code}`)
      return null
    }
  }
  // Fire-and-forget DB log (don't await, don't fail the send)
  prisma.sMSMessage.create({
    data: {
      direction: "OUTBOUND",
      body,
      fromNumber: process.env.TWILIO_PHONE_NUMBER || "unknown",
      toNumber: to,
      status: "SENT",
      sid,
      ...(opts?.contactId ? { contactId: opts.contactId } : {}),
    },
  }).catch(() => {})
  return sid
}

export async function initiateCall(to: string, callbackUrl: string): Promise<string | null> {
  const c = getClient()
  if (!c) {
    console.log("[CALL MOCK] To:", to)
    return "mock-call-sid"
  }
  // Use verified caller ID (Catherine's number) if set, otherwise fall back to Twilio number
  const callerId = process.env.TWILIO_CALLER_ID || process.env.TWILIO_PHONE_NUMBER!
  const call = await c.calls.create({
    to,
    from: callerId,
    url: callbackUrl,
    statusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/dialer/callback`,
  })
  return call.sid
}

export async function sendWhatsApp(to: string, body: string, mediaUrl?: string): Promise<string | null> {
  const c = getClient()
  const toNumber = to.startsWith("whatsapp:") ? to : `whatsapp:${toE164(to) || to}`
  // Use dedicated WhatsApp number if configured, otherwise fall back to SMS number
  const fromNumber = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER}`
  if (!c) {
    console.log("[WHATSAPP MOCK] To:", toNumber, "Body:", body)
    return "mock-wa-sid"
  }
  const msg = await c.messages.create({
    body,
    from: fromNumber,
    to: toNumber,
    ...(mediaUrl ? { mediaUrl: [mediaUrl] } : {}),
  })
  return msg.sid
}

export async function sendWhatsAppTemplate(
  to: string,
  contentSid: string,
  variables: Record<string, string>
): Promise<string | null> {
  const c = getClient()
  const toNumber = to.startsWith("whatsapp:") ? to : `whatsapp:${toE164(to) || to}`
  const fromNumber = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER}`
  if (!c) {
    console.log("[WHATSAPP TEMPLATE MOCK] To:", toNumber, "SID:", contentSid, "Vars:", variables)
    return "mock-wa-template-sid"
  }

  // Only pass variables that are actually defined (non-empty)
  // Some templates have no variables — don't pass contentVariables in that case
  const filteredVars: Record<string, string> = {}
  for (const [k, v] of Object.entries(variables)) {
    if (v) filteredVars[k] = v
  }
  const hasVars = Object.keys(filteredVars).length > 0

  console.log("[WHATSAPP TEMPLATE] from:", fromNumber, "to:", toNumber, "sid:", contentSid, "vars:", filteredVars)

  const msg = await (c.messages as any).create({
    from: fromNumber,
    to: toNumber,
    contentSid,
    ...(hasVars ? { contentVariables: JSON.stringify(filteredVars) } : {}),
  })
  return msg.sid
}

export async function getCallStatus(callSid: string) {
  const c = getClient()
  if (!c) return { status: "mock", duration: 0 }
  const call = await c.calls(callSid).fetch()
  return { status: call.status, duration: call.duration }
}
