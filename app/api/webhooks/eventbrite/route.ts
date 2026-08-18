export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { confirmEventbriteTicket } from "@/lib/eventbrite-confirm"

// Native Eventbrite webhook — no Zapier/Make needed. Eventbrite's own webhooks
// are free on every account. Set one up at:
//   Eventbrite → Account Settings → Developer → Webhooks → Add webhook
//   Payload URL: https://www.catherinegomezrealtor.com/api/webhooks/eventbrite
//   Actions: order.placed (add order.updated / attendee.updated if you like)
//
// Eventbrite does NOT send the attendee data in the webhook — it sends an
// `api_url` pointing at the order. We call that URL back with a private token
// (env EVENTBRITE_TOKEN) to fetch the buyer + attendees, map the event to its
// CRM tag, then run the shared confirm-ticket + stop-the-chase logic.
//
// Optional shared secret: set EVENTBRITE_WEBHOOK_SECRET and append
// `?secret=<value>` to the Payload URL to reject spoofed calls.

const EB_API_HOST = "https://www.eventbriteapi.com/"

// Map each Eventbrite event id (from the event URL) to its CRM tag — the SAME
// utm_content tag the Facebook form applies, so the right chase-plan stops.
const EVENT_TAG_BY_ID: Record<string, { tag: string; name: string }> = {
  "1998107399018": { tag: "Evento Septiembre 2026 Bogota", name: "Evento de Inversión en Miami — Bogotá" },
  "1998110626672": { tag: "Evento Medellin Septiembre 2026", name: "Evento de Inversión en Miami — Medellín" },
}

function phoneFromAnswers(answers?: any[]): string | undefined {
  if (!Array.isArray(answers)) return undefined
  const a = answers.find((x) => /phone|celular|tel|móvil|movil/i.test(x?.question || "") && x?.answer)
  return a?.answer || undefined
}

export async function POST(req: Request) {
  try {
    const secret = process.env.EVENTBRITE_WEBHOOK_SECRET
    if (secret) {
      const provided = new URL(req.url).searchParams.get("secret") || req.headers.get("x-eventbrite-secret")
      if (provided !== secret) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
    }

    const token = process.env.EVENTBRITE_TOKEN
    if (!token) {
      console.error("[eventbrite webhook] EVENTBRITE_TOKEN not set — cannot fetch order")
      // 200 so Eventbrite doesn't disable the webhook while it's being configured.
      return NextResponse.json({ ok: false, error: "not configured" })
    }

    const body = await req.json().catch(() => ({} as Record<string, any>))
    const apiUrl: string | undefined = body?.api_url
    const action: string = body?.config?.action || body?.action || ""
    if (!apiUrl) return NextResponse.json({ ok: true, skipped: "no api_url" })

    // SECURITY: only ever attach our token to a genuine Eventbrite API URL.
    if (!apiUrl.startsWith(EB_API_HOST)) {
      console.error(`[eventbrite webhook] refusing non-Eventbrite api_url: ${apiUrl}`)
      return NextResponse.json({ ok: false, error: "bad api_url" }, { status: 400 })
    }

    const url = `${apiUrl}${apiUrl.includes("?") ? "&" : "?"}expand=attendees,event`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) {
      const t = await res.text().catch(() => "")
      console.error(`[eventbrite webhook] fetch failed ${res.status}: ${t.slice(0, 200)}`)
      return NextResponse.json({ ok: false, error: `fetch ${res.status}` })
    }
    const data = await res.json()

    // The resource is an order (has attendees[]) or a single attendee (has profile).
    const eventId: string | undefined = data.event_id || data.event?.id
    const mapped = eventId ? EVENT_TAG_BY_ID[eventId] : undefined
    const eventName = mapped?.name || data.event?.name?.text || undefined
    const eventTag = mapped?.tag || undefined

    // Order-level buyer info — used as a fallback when an attendee record
    // doesn't carry its own email/name (common for simple single-ticket orders:
    // the email lives on the ORDER, not the attendee profile).
    const orderEmail: string | undefined = data.email || undefined
    const orderFirst: string | undefined = data.first_name || (data.name ? String(data.name).split(" ")[0] : undefined)
    const orderLast: string | undefined = data.last_name || (data.name && String(data.name).includes(" ") ? String(data.name).split(" ").slice(1).join(" ") : undefined)

    const attendees: any[] = Array.isArray(data.attendees) && data.attendees.length
      ? data.attendees
      : data.profile
        ? [data]
        : [{ profile: {} }]

    const results = []
    for (const a of attendees) {
      const p = a.profile || {}
      const firstName = p.first_name || (p.name ? String(p.name).split(" ")[0] : undefined) || orderFirst
      const lastName = p.last_name || (p.name && String(p.name).includes(" ") ? String(p.name).split(" ").slice(1).join(" ") : undefined) || orderLast
      const email = p.email || orderEmail
      results.push(await confirmEventbriteTicket({
        firstName,
        lastName,
        email,
        phone: p.cell_phone || phoneFromAnswers(a.answers) || undefined,
        eventName,
        eventTag,
      }))
    }

    const stoppedChase = results.reduce((n, r) => n + (r?.stoppedChase || 0), 0)
    console.log(`[eventbrite webhook] action=${action} event=${eventId || "?"} tag=${eventTag || "(unmapped)"} attendees=${results.length} stoppedChase=${stoppedChase}`)
    return NextResponse.json({ ok: true, event: eventId, tag: eventTag, processed: results.length, stoppedChase, results })
  } catch (e) {
    console.error("[eventbrite webhook]", e)
    // 200 to avoid Eventbrite disabling the webhook after repeated retries.
    return NextResponse.json({ ok: false, error: "failed" })
  }
}
