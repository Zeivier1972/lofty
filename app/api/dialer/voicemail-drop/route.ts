export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import twilio from "twilio"
import { normalizePhone } from "@/lib/utils"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { phone, audioUrl } = await req.json()
  if (!phone || !audioUrl) {
    return NextResponse.json({ error: "phone and audioUrl required" }, { status: 400 })
  }

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    return NextResponse.json({ error: "Twilio not configured" }, { status: 500 })
  }

  const to = normalizePhone(phone)

  // machineDetection: "DetectMessageEnd" tells Twilio to wait for the voicemail
  // beep before executing the TwiML — the recording plays right after the beep.
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Play>${audioUrl}</Play></Response>`

  try {
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    const call = await client.calls.create({
      to,
      from: TWILIO_PHONE_NUMBER,
      twiml,
      machineDetection: "DetectMessageEnd",
    })
    return NextResponse.json({ ok: true, sid: call.sid })
  } catch (e: any) {
    console.error("[voicemail-drop] Twilio error:", e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
