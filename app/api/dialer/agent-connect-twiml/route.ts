export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const identity = searchParams.get("identity") || ""
  const callerId = process.env.TWILIO_PHONE_NUMBER || ""

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerId}" timeout="30">
    <Client>${identity}</Client>
  </Dial>
</Response>`

  return new Response(twiml, {
    headers: { "Content-Type": "text/xml" },
  })
}
