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
    const callerId = process.env.TWILIO_CALLER_ID || process.env.TWILIO_PHONE_NUMBER!
    const appUrl   = process.env.NEXT_PUBLIC_APP_URL || ""

    const twiml = new twilio.twiml.VoiceResponse()
    // answerOnBridge → the browser hears ringing and the call only counts as
    // connected once the lead actually answers (accurate status, no dead air).
    const dial  = twiml.dial({
      callerId,
      answerOnBridge: true,
      ...(appUrl ? { record: "record-from-answer" as const, recordingStatusCallback: `${appUrl}/api/dialer/recording` } : {}),
    })
    dial.number(e164)

    return new Response(twiml.toString(), { headers: { "Content-Type": "text/xml" } })
  } catch (e: any) {
    console.error("[Twilio voice TwiML] error:", e)
    const err = new twilio.twiml.VoiceResponse()
    err.say("An error occurred.")
    return new Response(err.toString(), { status: 500, headers: { "Content-Type": "text/xml" } })
  }
}
