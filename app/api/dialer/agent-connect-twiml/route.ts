export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"

// TwiML that bridges the answered contact call to Catherine's browser.
// Called by parallel-status when first human answer is detected.
export async function POST(req: NextRequest) {
  const identity = req.nextUrl.searchParams.get("identity") || "agent"
  const callerNum = process.env.TWILIO_PHONE_NUMBER || ""

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerNum}" timeout="30" record="record-from-answer">
    <Client>${identity}</Client>
  </Dial>
</Response>`

  return new NextResponse(twiml, {
    headers: { "Content-Type": "application/xml" },
  })
}

export async function GET(req: NextRequest) {
  return POST(req)
}
