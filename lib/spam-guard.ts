// Protección para los formularios públicos que crean contactos y DISPARAN
// CORREOS. El registro del portal no tenía ninguna: cualquiera podía crear los
// leads que quisiera, tantas veces como quisiera, y cada intento mandaba un
// correo real a la dirección que escribieran. Eso ensucia el CRM y, peor, deja
// que un tercero use el dominio de Catherine para enviar correo — que es como
// se arruina la reputación de envío y los correos legítimos empiezan a caer en
// spam.

/** La IP real detrás del proxy de Railway. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return fwd || req.headers.get("x-real-ip")?.trim() || "desconocida"
}

/**
 * Validación de correo del lado del servidor. El formulario usa type="email",
 * pero eso solo protege a quien usa el formulario — un bot va directo al
 * endpoint.
 */
const EMAIL_OK = /^[^\s@,;:<>()[\]\\]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i
export function isLikelyEmail(s: string): boolean {
  const v = (s || "").trim()
  if (v.length < 6 || v.length > 254) return false
  if (!EMAIL_OK.test(v)) return false
  const tld = v.split(".").pop() || ""
  return tld.length >= 2 && !/\d/.test(tld)
}

/**
 * Un campo oculto que una persona nunca ve ni llena, y un bot que rellena todo
 * el formulario sí. Es la defensa con cero falsos positivos: no le pide nada al
 * visitante real, a diferencia de un captcha.
 */
export const HONEYPOT_FIELD = "company_website"
export function looksLikeBot(body: Record<string, any>): boolean {
  const v = body?.[HONEYPOT_FIELD]
  return typeof v === "string" && v.trim().length > 0
}

// ── Límite por IP ────────────────────────────────────────────────────────────
// En memoria del proceso a propósito: no hay tabla nueva ni migración. Se
// reinicia con cada despliegue y no se comparte entre instancias, así que NO es
// un muro — es un freno. El tope global contra la base es el que de verdad
// acota el daño, y ese sí sobrevive al reinicio.
type Hit = { count: number; resetAt: number }
const buckets = new Map<string, Hit>()

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now()
  const hit = buckets.get(key)
  if (!hit || now >= hit.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    // Barrido perezoso para que el Map no crezca sin límite.
    if (buckets.size > 5000) {
      buckets.forEach((v, k) => { if (now >= v.resetAt) buckets.delete(k) })
    }
    return { ok: true, retryAfterSec: 0 }
  }
  hit.count++
  if (hit.count > limit) return { ok: false, retryAfterSec: Math.ceil((hit.resetAt - now) / 1000) }
  return { ok: true, retryAfterSec: 0 }
}

/** Para las pruebas: deja los contadores en blanco. */
export function __resetRateLimits() { buckets.clear() }

export const PORTAL_LIMITS = {
  /** Registros por IP por hora. Una familia compartiendo wifi cabe de sobra. */
  perIp: 3,
  perIpWindowMs: 60 * 60 * 1000,
  /** Tope global por hora. Acota cuántos correos puede disparar un ataque
   *  distribuido, que es el daño que de verdad importa. */
  globalPerHour: 20,
  /** No reenviar el correo de bienvenida a la misma dirección más seguido. */
  resendCooldownMs: 60 * 60 * 1000,
}
