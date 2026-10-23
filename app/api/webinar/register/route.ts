export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { registerForWebinar } from "@/lib/webinar"
import { capiSignalsFromRequest } from "@/lib/facebook"

/**
 * Public webinar signup. No auth — this is the form on the landing page.
 *
 * Deliberately thin: everything that matters (email validation, contact
 * dedupe via ingestLead, the upsert that stops a double signup being reminded
 * twice) lives in lib/webinar so the same path serves any other caller.
 */
export async function POST(req: Request) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Solicitud inválida." }, { status: 400 })
  }

  const { slug, email, firstName, lastName, phone, source, smsConsent } = body || {}
  if (!slug) return NextResponse.json({ ok: false, error: "Falta el webinar." }, { status: 400 })

  const result = await registerForWebinar({
    slug: String(slug),
    email: String(email || ""),
    firstName: String(firstName || ""),
    lastName: lastName ? String(lastName) : undefined,
    phone: phone ? String(phone) : undefined,
    source: source ? String(source) : undefined,
    smsConsent: !!smsConsent,
    // Read off the request rather than asked for from the client: the _fbp and
    // _fbc cookies travel with this same-origin fetch on their own.
    capi: capiSignalsFromRequest(req),
  })

  if (!result.ok) return NextResponse.json(result, { status: 400 })

  return NextResponse.json({
    ok: true,
    alreadyRegistered: result.alreadyRegistered,
    webinarTitle: result.webinarTitle,
    startsAt: result.startsAt.toISOString(),
    // The join link is handed over right away when it exists, so somebody
    // registering five minutes before the start is not waiting on an email.
    joinUrl: result.joinUrl,
  })
}
