export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { zoomConfigured, zoomWebhookConfigured, getMe, createMeeting, deleteMeeting } from "@/lib/zoom"

/**
 * Zoom self-test. Open it in the browser while logged in:
 *   /api/zoom/test
 *
 * Setting up a Server-to-Server OAuth app is a dozen screens — credentials,
 * scopes, an event subscription, activation — and nothing tells you whether
 * the combination actually works until a real webinar fails to get a meeting.
 * This exercises the whole chain and says which step broke, so the first time
 * Zoom is called is not the morning of the first webinar.
 *
 * It creates a meeting a day out, then DELETES it. Nothing is left on the
 * calendar, and nothing is written to the CRM.
 *
 * Each step maps to one scope, so a failure names what is missing:
 *   token   → the three credentials in Railway
 *   me      → user:read:user:admin
 *   create  → meeting:write:meeting:admin
 *   delete  → meeting:write:meeting:admin (same scope; a failure here only
 *             leaves a stray test meeting, it does not mean the setup is bad)
 */
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const steps: { step: string; ok: boolean; detail?: string }[] = []
  const push = (step: string, ok: boolean, detail?: string) => steps.push({ step, ok, detail })

  // ── 1. Are the variables even there? ──────────────────────────────────────
  const configured = zoomConfigured()
  push("credenciales en Railway", configured,
    configured ? "ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID y ZOOM_CLIENT_SECRET presentes"
      : "falta alguna de ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET")

  push("token de webhook", zoomWebhookConfigured(),
    zoomWebhookConfigured() ? "ZOOM_WEBHOOK_SECRET_TOKEN presente"
      : "falta ZOOM_WEBHOOK_SECRET_TOKEN — la asistencia no se va a registrar")

  if (!configured) {
    return NextResponse.json({ ok: false, steps, next: "Agrega las variables en Railway y espera el redeploy." })
  }

  // ── 2. OAuth + the user read scope, in one call ───────────────────────────
  const me = await getMe()
  push("autenticar y leer la cuenta (user:read:user:admin)", me.ok,
    me.ok ? `cuenta ${me.email || "?"}` : me.error)

  if (!me.ok) {
    return NextResponse.json({
      ok: false,
      steps,
      next: "Si dice 'Invalid access token' revisa las tres credenciales. Si habla de scopes, falta user:read:user:admin.",
    })
  }

  // ── 3. The one that matters: can it create a meeting? ─────────────────────
  const startsAt = new Date(Date.now() + 24 * 3600 * 1000)
  const created = await createMeeting({
    topic: "CASAi — prueba de configuración (se borra sola)",
    startsAt,
    durationMins: 30,
    timezone: "America/New_York",
    agenda: "Reunión de prueba creada por /api/zoom/test. Se elimina inmediatamente.",
  })

  push("crear una reunión (meeting:write:meeting:admin)", created.ok,
    created.ok ? `id ${created.meetingId}` : created.error)

  if (!created.ok) {
    return NextResponse.json({
      ok: false,
      steps,
      next: "Falta el scope meeting:write:meeting:admin — 'Create a meeting for a user', la variante :admin, no :master.",
    })
  }

  // ── 4. Clean up after ourselves ───────────────────────────────────────────
  const deleted = await deleteMeeting(created.meetingId)
  push("borrar la reunión de prueba", deleted.ok,
    deleted.ok ? "la agenda queda limpia" : `${deleted.error} — borra "CASAi — prueba de configuración" a mano`)

  return NextResponse.json({
    ok: true,
    steps,
    joinUrlSample: created.joinUrl,
    next: zoomWebhookConfigured()
      ? "Zoom está listo. Falta una sola prueba real: un webinar de verdad, para ver llegar los eventos de asistencia."
      : "Zoom crea reuniones, pero sin ZOOM_WEBHOOK_SECRET_TOKEN no se va a registrar quién asistió.",
  })
}
