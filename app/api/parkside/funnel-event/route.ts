export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

/**
 * POST /api/parkside/funnel-event — where people quit the /parkside/colombia
 * quiz. One log line per event (no database): read them in the Railway logs
 * with the filter "[parkside-funnel]". `sid` is a random per-visit id, so a
 * visit can be followed from view to submit. Public; only known event names
 * and short values are logged.
 */

const EVENTS = new Set(["view", "answer", "contact_view", "submit_ok", "submit_error", "whatsapp_click"])
const short = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/[^\w\-áéíóúñ ]/gi, "").slice(0, n) : "")

export async function POST(req: Request) {
  let body: any = {}
  try { body = JSON.parse(await req.text()) } catch { /* sendBeacon text */ }
  const ev = short(body.event, 20)
  if (!EVENTS.has(ev)) return NextResponse.json({ ok: false }, { status: 400 })
  const step = Number.isFinite(Number(body.step)) ? Number(body.step) : ""
  console.log(`[parkside-funnel] sid=${short(body.sid, 16)} ev=${ev} step=${step} key=${short(body.key, 20)} ad=${body.ad ? 1 : 0}`)
  return NextResponse.json({ ok: true })
}
