export const dynamic = "force-dynamic"

import twilio from "twilio"

// TwiML for outbound dialer calls. Handles BOTH shapes so it works no matter
// which URL the Twilio TwiML App's Voice endpoint is pointed at:
//   • Browser softphone: Twilio POSTs "To" (from Device.connect({params:{To}}))
//     → dial the lead's number and bridge audio to this browser.
//   • Server-initiated leg (?callId=…, no To) → bridge to the agent's browser
//     Client so the agent can talk.
async function readTo(req: Request): Promise<string> {
  const url = new URL(req.url)
  let to = url.searchParams.get("To") || url.searchParams.get("to") || ""
  if (!to) {
    try {
      const f = await req.formData()
      to = (f.get("To") || f.get("to") || "").toString()
    } catch { /* no form body */ }
  }
  return to.trim()
}

function buildTwiml(to: string): string {
  const vr = new twilio.twiml.VoiceResponse()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ""
  const callerId = process.env.TWILIO_CALLER_ID || process.env.TWILIO_PHONE_NUMBER || ""
  const recording: any = appUrl
    ? { record: "record-from-answer", recordingStatusCallback: `${appUrl}/api/dialer/recording` }
    : {}

  const isPhone = to && /^\+?[1-9]\d{6,14}$/.test(to.replace(/[\s\-().]/g, ""))
  if (isPhone) {
    // Browser softphone → dial the lead's number, bridge audio to this browser.
    const digits = to.replace(/\D/g, "")
    const e164 = digits.length === 10 ? `+1${digits}` : `+${digits}`
    const dial = vr.dial({ callerId, answerOnBridge: true, ...recording })
    dial.number(e164)
  } else {
    // Server-initiated leg → bridge to the agent's browser Client.
    const dial = vr.dial({ callerId, ...recording })
    dial.client(process.env.TWILIO_CLIENT_ID || "agent")
  }
  return vr.toString()
}

export async function POST(req: Request) {
  const to = await readTo(req)
  return new Response(buildTwiml(to), { headers: { "Content-Type": "text/xml" } })
}

export async function GET(req: Request) {
  const to = await readTo(req)
  return new Response(buildTwiml(to), { headers: { "Content-Type": "text/xml" } })
}
