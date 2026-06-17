export const dynamic = "force-dynamic"

// Required Railway env vars for Twilio Voice SDK browser phone:
//   TWILIO_ACCOUNT_SID     — from Twilio Console → Account → General Settings
//   TWILIO_API_KEY         — from Twilio Console → Account → API Keys & Tokens → Create API Key
//   TWILIO_API_SECRET      — shown once when creating the API Key above
//   TWILIO_TWIML_APP_SID   — from Twilio Console → Voice → TwiML Apps → Create
//                            Voice Request URL: https://your-app.railway.app/api/dialer/agent-connect-twiml

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import twilio from "twilio"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const apiKey = process.env.TWILIO_API_KEY_SID || process.env.TWILIO_API_KEY
  const apiSecret = process.env.TWILIO_API_KEY_SECRET || process.env.TWILIO_API_SECRET
  const appSid = process.env.TWILIO_TWIML_APP_SID

  if (!accountSid || !apiKey || !apiSecret) {
    console.warn("[Dialer Token] Missing Twilio API credentials — returning mock token")
    return NextResponse.json({
      token: "mock-token",
      identity: `agent-${session.user.id}`,
      mock: true,
    })
  }

  const identity = `agent-${session.user.id}`
  const AccessToken = twilio.jwt.AccessToken
  const VoiceGrant = AccessToken.VoiceGrant

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: appSid,
    incomingAllow: true,
  })

  const token = new AccessToken(accountSid, apiKey, apiSecret, {
    identity,
    ttl: 3600,
  })
  token.addGrant(voiceGrant)

  return NextResponse.json({ token: token.toJwt(), identity })
}
