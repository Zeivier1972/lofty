export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { ingestLead } from "@/lib/lead-ingest"

// Eventbrite → CASAi lead intake (via Zapier/Make, which expands the attendee).
// Tags each registrant by their event so they auto-enroll in the matching Smart
// Plan and are trackable per event. Reusable for every event (Colombia, Costa
// Rica, etc.) — point the Zap here and pass the event name (+ an optional `tag`
// that triggers the Smart Plan you want).
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
  // Optional shared-secret check (set ZAPIER_SECRET in Railway to require it).
  const secret = process.env.ZAPIER_SECRET
  if (secret) {
    const provided = req.headers.get("x-zapier-secret") || new URL(req.url).searchParams.get("secret")
    if (provided !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    let body: Record<string, any> = {}
    const ct = req.headers.get("content-type") || ""
    if (ct.includes("application/json")) {
      body = await req.json()
    } else {
      const text = await req.text()
      try { body = JSON.parse(text) } catch {
        const p = new URLSearchParams(text); p.forEach((v, k) => { body[k] = v })
      }
    }

    const get = reader(body)
    const rawName = get("name", "full_name", "attendee_name", "firstName", "first_name") || ""
    const firstName = get("firstName", "first_name", "firstname")?.split(" ")[0] || rawName.split(" ")[0] || "Invitado"
    const lastName = get("lastName", "last_name", "lastname") || (rawName.includes(" ") ? rawName.split(" ").slice(1).join(" ") : undefined)
    const email = get("email", "email_address", "Email")
    const phone = get("phone", "cell_phone", "phone_number", "mobile", "cell", "Phone")

    if (!email && !phone) {
      return NextResponse.json({ error: "email or phone required" }, { status: 400 })
    }

    const eventName = get("event_name", "event", "eventName", "event_title", "title")
    const country = get("country", "pais", "país")
    const message = get("message", "notes", "comment")

    // Build tags: an "Evento: X" tag for tracking + any explicit tag(s) you set in
    // the Zap (use the exact tag that triggers the Smart Plan you want).
    const tags: string[] = []
    if (eventName) tags.push(`Evento: ${eventName}`)
    const explicit = get("tag", "tags")
    if (explicit) explicit.split(",").map(s => s.trim()).filter(Boolean).forEach(t => tags.push(t))
    if (country) tags.push(country)

    const { contactId, isNew } = await ingestLead({
      firstName,
      lastName,
      email,
      phone,
      source: "EVENTBRITE",
      campaign: eventName || "Eventbrite",
      message: message || (eventName ? `Se registró en el evento: ${eventName}` : undefined),
      smsConsent: !!phone,
      tags: tags.length ? tags : undefined,
    })

    return NextResponse.json({ ok: true, contactId, isNew, tags })
  } catch (e) {
    console.error("[eventbrite intake]", e)
    return NextResponse.json({ error: "Failed to ingest" }, { status: 500 })
  }
}
