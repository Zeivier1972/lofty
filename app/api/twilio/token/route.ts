export const dynamic = "force-dynamic"

// Twilio Access Token for browser-based Voice (Catherine's softphone)
//
// Required env vars (set in Railway + .env.local):
//   TWILIO_API_KEY_SID     — create at console.twilio.com → Account → API Keys & Tokens
//   TWILIO_API_KEY_SECRET  — shown once on creation; save it
//   TWILIO_TWIML_APP_SID   — create at console.twilio.com → Voice → TwiML Apps
//                            set the Voice URL to: https://your-domain.up.railway.app/api/twilio/voice

import { NextResponse } from "next/server"
import twilio from "twilio"

export async function GET() {
  const accountSid   = process.env.TWILIO_ACCOUNT_SID
  const apiKeySid    = process.env.TWILIO_API_KEY_SID
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET
  const twimlAppSid  = process.env.TWILIO_TWIML_APP_SID

  if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
    return NextResponse.json(
      { error: "Browser calling not configured. Set TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, and TWILIO_TWIML_APP_SID in your environment." },
      { status: 503 }
    )
  }

  try {
    const AccessToken = twilio.jwt.AccessToken
    const VoiceGrant  = AccessToken.VoiceGrant

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: false,
    })

    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
      identity: "catherine",
      ttl: 3600,
    })
    token.addGrant(voiceGrant)

    return NextResponse.json({ token: token.toJwt() })
  } catch (e: any) {
    console.error("[Twilio token] error:", e)
    return NextResponse.json({ error: "Failed to generate token" }, { status: 500 })
  }
}
