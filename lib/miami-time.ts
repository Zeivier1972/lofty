const ZONE = "America/New_York"

/**
 * A time typed in the CRM ("2026-11-14T10:00", from a date + time field) is
 * Miami wall-clock time. On the server (UTC) `new Date("2026-11-14T10:00")`
 * reads it as 10:00 UTC — 5 or 6 AM in Miami. Strings that already carry a
 * zone ("Z" or "+hh:mm") are taken as they are.
 */
export function parseMiamiWallTime(input: string): Date {
  const s = String(input || "").trim()
  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(s)) return new Date(s)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return new Date(s)
  const [, y, mo, d, h, mi, sec] = m.map(Number) as number[]
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, sec || 0)
  // Miami's offset at that moment (EST/EDT), from how it renders.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(asUtc))
  const g = (t: string) => Number(parts.find(p => p.type === t)?.value || 0)
  const shown = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"))
  const guess = asUtc + (asUtc - shown)
  // Second pass settles times next to a DST change.
  const parts2 = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(guess))
  const g2 = (t: string) => Number(parts2.find(p => p.type === t)?.value || 0)
  const shown2 = Date.UTC(g2("year"), g2("month") - 1, g2("day"), g2("hour"), g2("minute"), g2("second"))
  return new Date(guess + (asUtc - shown2))
}
