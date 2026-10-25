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

// ── Prueba de que la petición salió del formulario ───────────────────────────
// El campo trampa y el límite por IP suponen un bot que rellena formularios.
// El que está entrando no usa el formulario: le pega directo al endpoint, con
// datos limpios, despacio y desde IPs distintas. Contra ese, la trampa no
// existe en su petición y el límite nunca se alcanza.
//
// Esto le da la vuelta: en vez de detectar al bot, se exige una prueba de que
// la petición vino de la página real. El formulario pide un token firmado al
// cargar; quien postea a ciegas no lo tiene. Cero fricción para la persona.

import { createHmac, timingSafeEqual } from "crypto"

const SECRET = process.env.NEXTAUTH_SECRET || "portal-secret-fallback-change-in-prod"
/** Diez minutos: de sobra para llenar el formulario, corto para reutilizarlo. */
export const FORM_TOKEN_TTL_MS = 10 * 60 * 1000

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex")
}

/** Token para una página de formulario. `scope` lo ata a ese formulario. */
export function issueFormToken(scope: string, now = Date.now()): string {
  const payload = `${scope}.${now}`
  return `${payload}.${sign(payload)}`
}

export type FormTokenResult = "ok" | "falta" | "malformado" | "firma-invalida" | "vencido" | "futuro"

export function checkFormToken(token: unknown, scope: string, now = Date.now()): FormTokenResult {
  if (typeof token !== "string" || !token) return "falta"
  const parts = token.split(".")
  if (parts.length !== 3) return "malformado"
  const [tokenScope, tsRaw, mac] = parts
  if (tokenScope !== scope) return "malformado"
  const ts = Number(tsRaw)
  if (!Number.isFinite(ts)) return "malformado"

  const esperado = sign(`${tokenScope}.${tsRaw}`)
  // Comparación de tiempo constante: comparar con === filtra la firma carácter
  // a carácter y deja medir dónde falla.
  const a = Buffer.from(mac, "hex")
  const b = Buffer.from(esperado, "hex")
  if (a.length !== b.length || !timingSafeEqual(a, b)) return "firma-invalida"

  // Un reloj adelantado del lado del cliente no puede comprar tiempo extra.
  if (ts > now + 60 * 1000) return "futuro"
  if (now - ts > FORM_TOKEN_TTL_MS) return "vencido"
  return "ok"
}

export const PORTAL_FORM_SCOPE = "portal-register"
