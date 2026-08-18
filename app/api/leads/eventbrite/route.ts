export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { confirmEventbriteTicket } from "@/lib/eventbrite-confirm"

// Eventbrite → CASAi via a generic webhook tool (Zapier "Webhooks by Zapier",
// Make.com HTTP, etc.). This is the FLAT-payload path: the Zap maps name /
// email / phone / tag into the JSON body. For the free, no-Zapier path see
// /api/webhooks/eventbrite (native Eventbrite webhooks). Both share the same
// confirm-ticket + stop-the-chase logic in lib/eventbrite-confirm.
function reader(body: Record<string, any>) {
  return (...keys: string[]) => {
    for (const k of keys) {
      const v = body[k] ?? body[k.toLowerCase()] ?? body[k.toUpperCase()]
      if (v != null && String(v).trim()) return String(v).trim()
    }
    return undefined
  }
}

export async function POST(req: Request) {
  const secret = process.env.ZAPIER_SECRET
  if (secret) {
    const provided = req.headers.get("x-zapier-secret") || new URL(req.url).searchParams.get("secret")
    if (provided !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    let body: Record<string, any> = {}
    const ct = req.headers.get("content-type") || ""
    if (ct.includes("application/json")) body = await req.json()
    else {
      const text = await req.text()
      try { body = JSON.parse(text) } catch { const p = new URLSearchParams(text); p.forEach((v, k) => { body[k] = v }) }
    }

    const get = reader(body)
    const rawName = get("name", "full_name", "attendee_name", "firstName", "first_name") || ""
    const firstName = get("firstName", "first_name", "firstname")?.split(" ")[0] || rawName.split(" ")[0] || "Invitado"
    const lastName = get("lastName", "last_name", "lastname") || (rawName.includes(" ") ? rawName.split(" ").slice(1).join(" ") : undefined)
    const email = get("email", "email_address", "Email")
    const phone = get("phone", "cell_phone", "phone_number", "mobile", "cell", "Phone")
    if (!email && !phone) return NextResponse.json({ error: "email or phone required" }, { status: 400 })

    const eventName = get("event_name", "event", "eventName", "event_title", "title")
    const eventTag = get("tag", "event_tag", "tags")   // the event tag whose chase-plan should stop

    const { contactId, confirmedTag, stoppedChase } = await confirmEventbriteTicket({
      firstName, lastName, email, phone, eventName, eventTag,
    })

    return NextResponse.json({ ok: true, contactId, confirmedTag, stoppedChase })
  } catch (e) {
    console.error("[eventbrite confirm]", e)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
