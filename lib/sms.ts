import twilio from "twilio"

let client: twilio.Twilio | null = null

function getClient() {
  if (!client && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  }
  return client
}

export async function sendSMS(to: string, body: string, mediaUrls?: string[]): Promise<string | null> {
  const c = getClient()
  if (!c) {
    console.log("[SMS MOCK] To:", to, "Body:", body, "Media:", mediaUrls)
    return "mock-sid"
  }
  const msg = await c.messages.create({
    body,
    from: process.env.TWILIO_PHONE_NUMBER!,
    to,
    ...(mediaUrls?.length ? { mediaUrl: mediaUrls } : {}),
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

export async function sendWhatsApp(to: string, body: string, mediaUrl?: string): Promise<string | null> {
  const c = getClient()
  const toNumber = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`
  // Use dedicated WhatsApp number if configured, otherwise fall back to SMS number
  const fromNumber = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER}`
  if (!c) {
    console.log("[WHATSAPP MOCK] To:", toNumber, "Body:", body)
    return "mock-wa-sid"
  }
  const msg = await c.messages.create({
    body,
    from: fromNumber,
    to: toNumber,
    ...(mediaUrl ? { mediaUrl: [mediaUrl] } : {}),
  })
  return msg.sid
}

export async function sendWhatsAppTemplate(
  to: string,
  contentSid: string,
  variables: Record<string, string>
): Promise<string | null> {
  const c = getClient()
  const toNumber = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`
  const fromNumber = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER}`
  if (!c) {
    console.log("[WHATSAPP TEMPLATE MOCK] To:", toNumber, "SID:", contentSid, "Vars:", variables)
    return "mock-wa-template-sid"
  }

  // Only pass variables that are actually defined (non-empty)
  // Some templates have no variables — don't pass contentVariables in that case
  const filteredVars: Record<string, string> = {}
  for (const [k, v] of Object.entries(variables)) {
    if (v) filteredVars[k] = v
  }
  const hasVars = Object.keys(filteredVars).length > 0

  console.log("[WHATSAPP TEMPLATE] from:", fromNumber, "to:", toNumber, "sid:", contentSid, "vars:", filteredVars)

  const msg = await (c.messages as any).create({
    from: fromNumber,
    to: toNumber,
    contentSid,
    ...(hasVars ? { contentVariables: JSON.stringify(filteredVars) } : {}),
  })
  return msg.sid
}

export async function getCallStatus(callSid: string) {
  const c = getClient()
  if (!c) return { status: "mock", duration: 0 }
  const call = await c.calls(callSid).fetch()
  return { status: call.status, duration: call.duration }
}
