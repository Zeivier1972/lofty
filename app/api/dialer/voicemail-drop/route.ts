export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import twilio from "twilio"
import { normalizePhone } from "@/lib/utils"
import { sendSMS, sanitizeSmsBody, toE164 } from "@/lib/sms"

// Voicemail drop. Two modes:
//  • audioUrl → place a Twilio call that plays a pre-recorded message after the
//    voicemail beep (machineDetection).
//  • text     → send the message as a single GSM-7 SMS. Agent-initiated, so it
//    skips the per-lead cooldown, but sendSMS still enforces do-not-text + the
//    global SMS kill switch.
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { phone, audioUrl, text, contactId } = await req.json()
  if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 })
  if (!audioUrl && !text?.trim()) {
    return NextResponse.json({ error: "audioUrl or text required" }, { status: 400 })
  }

  // Personalize {first_name}/{nombre} if we know the contact.
  let firstName = ""
  if (contactId) {
    const c = await prisma.contact.findUnique({ where: { id: contactId }, select: { firstName: true } }).catch(() => null)
    firstName = (c?.firstName || "").trim()
  }

  // ── Recorded-audio drop ──────────────────────────────────────────────────
  if (audioUrl) {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      return NextResponse.json({ error: "Twilio not configured" }, { status: 500 })
    }
    const to = normalizePhone(phone)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Play>${audioUrl}</Play></Response>`
    try {
      const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
      const call = await client.calls.create({ to, from: TWILIO_PHONE_NUMBER, twiml, machineDetection: "DetectMessageEnd" })
      if (contactId) {
        await prisma.activity.create({
          data: { type: "CALL", title: "Dialer: mensaje de voz grabado enviado", contactId },
        }).catch(() => {})
      }
      return NextResponse.json({ ok: true, sid: call.sid })
    } catch (e: any) {
      console.error("[voicemail-drop] Twilio error:", e.message)
      return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
    }
  }

  // ── Text drop (SMS) ──────────────────────────────────────────────────────
  const filled = String(text).replace(/\{first_name\}|\{nombre\}/gi, firstName)
  const body = sanitizeSmsBody(filled)
  const to = toE164(phone)
  const sid = await sendSMS(to, body, undefined, { contactId }) // not automated → skips cooldown; still respects do-not-text + kill switch
  if (sid) {
    await prisma.sMSMessage.create({
      data: { body, fromNumber: process.env.TWILIO_PHONE_NUMBER || "", toNumber: to, direction: "OUTBOUND", status: "SENT", contactId: contactId || undefined },
    }).catch(() => {})
    if (contactId) {
      await prisma.activity.create({
        data: { type: "SMS", title: "Dialer: mensaje de voz (texto) enviado", description: body.slice(0, 140), contactId },
      }).catch(() => {})
    }
  }
  return NextResponse.json({ ok: !!sid, error: sid ? undefined : "No se pudo enviar (número bloqueado, sin texto, o SMS en pausa)" })
}
