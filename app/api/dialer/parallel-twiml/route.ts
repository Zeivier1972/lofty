export const dynamic = "force-dynamic"

export async function POST() {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">Thank you for your interest in Catherine Gomez Realty. Please hold for just a moment.</Say>
  <Pause length="90"/>
</Response>`

  return new Response(twiml, {
    headers: { "Content-Type": "text/xml" },
  })
}
