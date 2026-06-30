export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import twilio from "twilio"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { twilioSid } = await req.json()
  if (!twilioSid || twilioSid.startsWith("mock-")) {
    return NextResponse.json({ ok: true })
  }

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return NextResponse.json({ ok: true })
  }

  try {
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    await client.calls(twilioSid).update({ status: "completed" })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    // 20404 = call already ended — treat as success
    if (e.code === 20404 || e.status === 404) {
      return NextResponse.json({ ok: true })
    }
    console.error("[dialer/hangup] Failed to terminate call:", e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
