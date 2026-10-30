/**
 * Wall-clock time in Miami → the real instant.
 *
 * Booking slots are picked as "2026-11-03" + "14:30" meaning 2:30pm in
 * Catherine's time. `new Date("2026-11-03T14:30:00")` reads that in the
 * *server's* zone, and the server runs on UTC, so every booking was stored
 * 4–5 hours early and the reminders and calendar showed the wrong hour.
 */
export const AGENT_TZ = "America/New_York"

export function easternWallTime(date: string, time = "00:00", seconds = "00"): Date {
  const asUtc = new Date(`${date}T${time}:${seconds}Z`)
  if (isNaN(asUtc.getTime())) return asUtc
  // How far Eastern is behind UTC at that moment (DST-aware).
  const eastern = new Date(asUtc.toLocaleString("en-US", { timeZone: AGENT_TZ }))
  const utc = new Date(asUtc.toLocaleString("en-US", { timeZone: "UTC" }))
  return new Date(asUtc.getTime() + (utc.getTime() - eastern.getTime()))
}

/** "martes, 3 de noviembre, 2:30 p. m." in Catherine's zone. */
export function formatEastern(d: Date, locale = "es-US"): string {
  return d.toLocaleString(locale, {
    timeZone: AGENT_TZ, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  })
}
