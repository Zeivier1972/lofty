export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const callId = searchParams.get("callId")

  // TwiML response to connect the call
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${process.env.TWILIO_PHONE_NUMBER}" record="record-from-answer" recordingStatusCallback="${process.env.NEXT_PUBLIC_APP_URL}/api/dialer/recording">
    <Client>${process.env.TWILIO_CLIENT_ID || "agent"}</Client>
  </Dial>
</Response>`

  return new NextResponse(twiml, {
    headers: { "Content-Type": "application/xml" },
  })
}

export async function POST(req: Request) {
  // Same for POST (Twilio uses POST for TwiML requests)
  return GET(req)
}
