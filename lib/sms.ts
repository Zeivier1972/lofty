import twilio from "twilio"

let client: twilio.Twilio | null = null

function getClient() {
  if (!client && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  }
  return client
}

export async function sendSMS(to: string, body: string): Promise<string | null> {
  const c = getClient()
  if (!c) {
    console.log("[SMS MOCK] To:", to, "Body:", body)
    return "mock-sid"
  }
  const msg = await c.messages.create({
    body,
    from: process.env.TWILIO_PHONE_NUMBER!,
    to,
  })
  return msg.sid
}

export async function initiateCall(to: string, callbackUrl: string): Promise<string | null> {
  const c = getClient()
  if (!c) {
    console.log("[CALL MOCK] To:", to)
    return "mock-call-sid"
  }
  const call = await c.calls.create({
    to,
    from: process.env.TWILIO_PHONE_NUMBER!,
    url: callbackUrl,
    statusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/dialer/callback`,
  })
  return call.sid
}

export async function getCallStatus(callSid: string) {
  const c = getClient()
  if (!c) return { status: "mock", duration: 0 }
  const call = await c.calls(callSid).fetch()
  return { status: call.status, duration: call.duration }
}
