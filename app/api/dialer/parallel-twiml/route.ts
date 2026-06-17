export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

// TwiML served to outbound calls while waiting for first-answer detection.
// The call stays on hold until parallel-status webhook redirects it.
export async function POST() {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">Thank you for your interest in Catherine Gomez Realty. Please hold for just a moment.</Say>
  <Pause length="90"/>
</Response>`

  return new NextResponse(twiml, {
    headers: { "Content-Type": "application/xml" },
  })
}

export async function GET() {
  return POST()
}
