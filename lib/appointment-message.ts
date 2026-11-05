import { sendSMS, sendWhatsAppTemplate, toE164 } from "@/lib/sms"
import { AGENT_TZ } from "@/lib/eastern-time"

/**
 * Appointment confirmations and reminders to the lead's phone.
 *
 * US numbers get the SMS they always got. International numbers (Colombia
 * first) get WhatsApp instead when an approved template is configured: SMS
 * from a US number to +57 is expensive, often filtered, and nobody there
 * reads SMS — WhatsApp is where they are. A business-started WhatsApp needs
 * an approved template (a free-form message fails with 63016 unless the
 * person wrote in the last 24 h), hence the two template SIDs:
 *
 *   TWILIO_WA_APPT_CONFIRM_SID   "Hola {{1}}, tu cita con Catherine Gomez quedó confirmada para el {{2}}. {{3}}"
 *   TWILIO_WA_APPT_REMINDER_SID  "Hola {{1}}, te recuerdo tu cita con Catherine Gomez: {{2}}. {{3}}"
 *
 * Without them, or if WhatsApp fails, it falls back to SMS.
 */

/** Country prefix → time zone people there read times in. */
const LOCAL_TZ: [string, string, string][] = [
  ["+57", "America/Bogota", "Colombia"],
  ["+52", "America/Mexico_City", "México"],
  ["+58", "America/Caracas", "Venezuela"],
  ["+593", "America/Guayaquil", "Ecuador"],
  ["+51", "America/Lima", "Perú"],
  ["+507", "America/Panama", "Panamá"],
  ["+506", "America/Costa_Rica", "Costa Rica"],
  ["+502", "America/Guatemala", "Guatemala"],
  ["+503", "America/El_Salvador", "El Salvador"],
  ["+504", "America/Tegucigalpa", "Honduras"],
  ["+54", "America/Argentina/Buenos_Aires", "Argentina"],
  ["+56", "America/Santiago", "Chile"],
  ["+598", "America/Montevideo", "Uruguay"],
  ["+55", "America/Sao_Paulo", "Brasil"],
  ["+34", "Europe/Madrid", "España"],
]

/** The time zone and country a phone number's owner reads times in; null for US/Canada or unknown. */
export function localZoneFor(phone: string | null | undefined): { tz: string; country: string } | null {
  const e164 = toE164(phone || "") || phone || ""
  const hit = LOCAL_TZ.find(([code]) => e164.startsWith(code))
  return hit ? { tz: hit[1], country: hit[2] } : null
}

export function isInternational(phone: string | null | undefined): boolean {
  const e164 = toE164(phone || "") || phone || ""
  return e164.startsWith("+") && !e164.startsWith("+1")
}

/** "martes 10 de noviembre, 3:00 p. m. hora de Miami (3:00 p. m. en Colombia)". */
export function whenFor(start: Date, phone: string | null | undefined): string {
  const miami = start.toLocaleString("es-US", {
    timeZone: AGENT_TZ, weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit",
  })
  const local = localZoneFor(phone)
  if (!local) return `${miami} (hora de Miami)`
  // The day too when it differs (Spain is already "tomorrow" for a 7 p.m. Miami start).
  const sameDay = start.toLocaleDateString("en-US", { timeZone: AGENT_TZ }) === start.toLocaleDateString("en-US", { timeZone: local.tz })
  const there = sameDay
    ? start.toLocaleTimeString("es-US", { timeZone: local.tz, hour: "numeric", minute: "2-digit" })
    : start.toLocaleString("es-US", { timeZone: local.tz, weekday: "long", hour: "numeric", minute: "2-digit" })
  return `${miami} hora de Miami (${there} en ${local.country})`
}

/**
 * Send one appointment message. Returns true when something went out.
 * `smsText` is the US/fallback text; `how` is the Zoom link or call line.
 */
export async function sendAppointmentMessage(opts: {
  kind: "confirm" | "reminder"
  phone: string
  contactId: string
  firstName: string
  start: Date
  how: string
  smsText: string
}): Promise<boolean> {
  const sid = opts.kind === "confirm" ? process.env.TWILIO_WA_APPT_CONFIRM_SID : process.env.TWILIO_WA_APPT_REMINDER_SID
  if (sid && isInternational(opts.phone)) {
    try {
      const out = await sendWhatsAppTemplate(opts.phone, sid, {
        "1": opts.firstName || "",
        "2": whenFor(opts.start, opts.phone),
        "3": opts.how,
      })
      if (out) return true
    } catch (e) {
      console.error(`[appointment-message] WhatsApp ${opts.kind} failed, falling back to SMS:`, e)
    }
  }
  const sms = await sendSMS(opts.phone, opts.smsText, undefined, { contactId: opts.contactId }).catch(() => null)
  return !!sms
}
