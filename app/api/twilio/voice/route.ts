export const dynamic = "force-dynamic"

// TwiML endpoint called by Twilio when the browser client places an outbound call.
// Twilio POSTs here with the "To" parameter set to whatever we pass in Device.connect({ params: { To } }).

import twilio from "twilio"

export async function POST(req: Request) {
  try {
    const body = await req.formData()
    const to   = (body.get("To") as string | null)?.trim()

    // Only allow E.164 phone numbers to prevent open relay abuse
    if (!to || !/^\+?[1-9]\d{6,14}$/.test(to.replace(/[\s\-().]/g, ""))) {
      const reject = new twilio.twiml.VoiceResponse()
      reject.say("Invalid destination.")
      return new Response(reject.toString(), { headers: { "Content-Type": "text/xml" } })
    }

    const digits  = to.replace(/\D/g, "")
    const e164    = digits.length === 10 ? `+1${digits}` : `+${digits}`
    const callerId = process.env.TWILIO_PHONE_NUMBER!

    const twiml = new twilio.twiml.VoiceResponse()
    const dial  = twiml.dial({ callerId })
    dial.number(e164)

    return new Response(twiml.toString(), { headers: { "Content-Type": "text/xml" } })
  } catch (e: any) {
    console.error("[Twilio voice TwiML] error:", e)
    const err = new twilio.twiml.VoiceResponse()
    err.say("An error occurred.")
    return new Response(err.toString(), { status: 500, headers: { "Content-Type": "text/xml" } })
  }
}
