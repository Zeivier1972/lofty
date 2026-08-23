import { prisma } from "@/lib/prisma"
import { searchIdxListings } from "@/lib/bridge"

// Shared integration health checks — used by the scheduled system-check cron
// (transition alerts + daily report) and the live /health dashboard. Every
// check catches its own errors and NEVER throws, so one failing check can't
// break the run.

export interface CheckResult {
  name: string
  ok: boolean
  detail?: string
  ms?: number
  critical?: boolean  // true = a real integration outage worth an SMS; false = informational
}

async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 8000): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal, cache: "no-store" })
  } finally {
    clearTimeout(t)
  }
}

async function checkDatabase(): Promise<CheckResult> {
  const t = Date.now()
  try {
    const count = await prisma.contact.count()
    return { name: "Base de datos", ok: true, detail: `${count} contactos`, ms: Date.now() - t, critical: true }
  } catch (e: any) {
    return { name: "Base de datos", ok: false, detail: e.message, ms: Date.now() - t, critical: true }
  }
}

async function checkBridgeMLS(): Promise<CheckResult> {
  const t = Date.now()
  try {
    if (!process.env.BRIDGE_SERVER_TOKEN) {
      return { name: "MLS (Bridge / MiamiRE)", ok: false, detail: "BRIDGE_SERVER_TOKEN no configurado", ms: 0, critical: true }
    }
    const listings = await searchIdxListings({ city: "Miami", limit: 3 })
    return { name: "MLS (Bridge / MiamiRE)", ok: listings.length > 0, detail: `${listings.length} propiedades`, ms: Date.now() - t, critical: true }
  } catch (e: any) {
    const msg = String(e?.message || e)
    const is401 = /401|unauthor/i.test(msg)
    return {
      name: "MLS (Bridge / MiamiRE)",
      ok: false,
      detail: is401 ? "401 — feed suspendido o token rechazado" : msg.slice(0, 140),
      ms: Date.now() - t,
      critical: true,
    }
  }
}

async function checkFacebook(): Promise<CheckResult> {
  const t = Date.now()
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN
  if (!token) return { name: "Facebook (Página / Leads)", ok: false, detail: "Token de página no configurado", ms: 0, critical: true }
  try {
    const res = await fetchWithTimeout(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(token)}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const m = data?.error?.message || `HTTP ${res.status}`
      return { name: "Facebook (Página / Leads)", ok: false, detail: `Token rechazado — ${m}`, ms: Date.now() - t, critical: true }
    }
    return { name: "Facebook (Página / Leads)", ok: true, detail: data?.name ? `Conectado: ${data.name}` : "Token válido", ms: Date.now() - t, critical: true }
  } catch (e: any) {
    return { name: "Facebook (Página / Leads)", ok: false, detail: String(e?.message || e).slice(0, 140), ms: Date.now() - t, critical: true }
  }
}

async function checkEventbrite(): Promise<CheckResult> {
  const t = Date.now()
  const token = process.env.EVENTBRITE_TOKEN
  if (!token) return { name: "Eventbrite", ok: false, detail: "EVENTBRITE_TOKEN no configurado", ms: 0, critical: false }
  try {
    const res = await fetchWithTimeout("https://www.eventbriteapi.com/v3/users/me/", { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { name: "Eventbrite", ok: false, detail: `Token rechazado — ${data?.error_description || res.status}`, ms: Date.now() - t, critical: true }
    }
    return { name: "Eventbrite", ok: true, detail: "Token válido", ms: Date.now() - t, critical: true }
  } catch (e: any) {
    return { name: "Eventbrite", ok: false, detail: String(e?.message || e).slice(0, 140), ms: Date.now() - t, critical: true }
  }
}

async function checkEmail(): Promise<CheckResult> {
  const hasResend = !!process.env.RESEND_API_KEY
  const hasSMTP = !!(process.env.SMTP_USER && process.env.SMTP_PASS)
  const ok = hasResend || hasSMTP
  return {
    name: "Email (Resend/SMTP)",
    ok,
    detail: ok ? (hasResend ? "Resend configurado" : "SMTP configurado") : "Sin RESEND_API_KEY ni SMTP",
    critical: true,
  }
}

async function checkSMS(): Promise<CheckResult> {
  const ok = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER)
  return {
    name: "SMS / WhatsApp (Twilio)",
    ok,
    detail: ok ? "Credenciales de Twilio configuradas" : "Faltan credenciales de Twilio",
    critical: true,
  }
}

async function checkAI(): Promise<CheckResult> {
  const ok = !!process.env.ANTHROPIC_API_KEY
  return {
    name: "IA (Anthropic — Sofía/Aria)",
    ok,
    detail: ok ? "ANTHROPIC_API_KEY configurada" : "ANTHROPIC_API_KEY no configurada — Sofía/Aria no funcionarán",
    critical: true,
  }
}

async function checkLeadFlow(): Promise<CheckResult> {
  const t = Date.now()
  try {
    const recent = await prisma.contact.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
    const total = await prisma.contact.count()
    return { name: "Flujo de leads (24h)", ok: true, detail: `${recent} nuevos · ${total} total`, ms: Date.now() - t, critical: false }
  } catch (e: any) {
    return { name: "Flujo de leads (24h)", ok: false, detail: e.message, ms: Date.now() - t, critical: false }
  }
}

async function checkEmailVolume(): Promise<CheckResult> {
  const t = Date.now()
  try {
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })
    const todayStart = new Date(`${todayStr}T00:00:00-05:00`)
    const count = await prisma.email.count({ where: { direction: "OUTBOUND", status: "SENT", createdAt: { gte: todayStart } } })
    const LIMIT = Number(process.env.EMAIL_DAILY_LIMIT || 100)
    const near = count >= LIMIT * 0.9
    return {
      name: "Volumen de email (hoy)",
      ok: !near,
      detail: `${count} enviados · límite ~${LIMIT}/día${near ? " — CERCA/SOBRE EL LÍMITE, emails pueden bloquearse" : ""}`,
      ms: Date.now() - t,
      critical: false, // informational — shown on dashboard/daily report, no repeated alert
    }
  } catch (e: any) {
    return { name: "Volumen de email (hoy)", ok: false, detail: e.message, ms: Date.now() - t, critical: false }
  }
}

// Run every check in parallel. Returns a stable-ordered list.
export async function runAllChecks(): Promise<CheckResult[]> {
  return Promise.all([
    checkDatabase(),
    checkBridgeMLS(),
    checkFacebook(),
    checkEventbrite(),
    checkEmail(),
    checkSMS(),
    checkAI(),
    checkEmailVolume(),
    checkLeadFlow(),
  ])
}
