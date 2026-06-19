export const dynamic = "force-dynamic"

// Railway env vars needed:
// TWILIO_ACCOUNT_SID - Your Twilio Account SID
// TWILIO_API_KEY - Twilio API Key (create at console.twilio.com/project/api-keys)
// TWILIO_API_SECRET - Twilio API Secret
// TWILIO_TWIML_APP_SID - TwiML App SID (create at console.twilio.com/voice/twiml/apps)
// TWILIO_PHONE_NUMBER - Your Twilio phone number

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import twilio from "twilio"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id
  const identity = `agent-${userId}`

  const {
    TWILIO_ACCOUNT_SID,
    TWILIO_API_KEY,
    TWILIO_API_SECRET,
    TWILIO_TWIML_APP_SID,
  } = process.env

  // Graceful fallback when Twilio credentials are not configured
  if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY || !TWILIO_API_SECRET) {
    console.log("[DIALER TOKEN MOCK] Returning mock token for identity:", identity)
    return NextResponse.json({ token: "mock-token", identity })
  }

  const AccessToken = twilio.jwt.AccessToken
  const VoiceGrant = AccessToken.VoiceGrant

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: TWILIO_TWIML_APP_SID,
    incomingAllow: true,
  })

  const accessToken = new AccessToken(
    TWILIO_ACCOUNT_SID,
    TWILIO_API_KEY,
    TWILIO_API_SECRET,
    { identity }
  )
  accessToken.addGrant(voiceGrant)

  return NextResponse.json({ token: accessToken.toJwt(), identity })
}
