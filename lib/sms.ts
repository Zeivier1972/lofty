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
  const digits10 = (to || "").replace(/\D/g, "").slice(-10)

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
    const msg = await c.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to,
      // Delivery receipts → mark failed sends + auto-flag dead numbers
      ...(appUrl ? { statusCallback: `${appUrl}/api/twilio/sms-status` } : {}),
      ...(mediaUrls?.length ? { mediaUrl: mediaUrls } : {}),
    })
    sid = msg.sid
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
