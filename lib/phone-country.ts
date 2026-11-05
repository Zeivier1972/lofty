/**
 * Country code for phone fields on public forms aimed at international buyers.
 *
 * Without it, a Colombian types "316 428 7900", toE164 reads ten digits as a
 * US number (+1 316…), the SMS fails, and the contact is permanently marked
 * do-not-text — and every reminder after that is email-only. US area codes
 * start with 3 too (305 is Miami), so the digits alone can't tell them apart:
 * the person has to say which country.
 */

export const PHONE_COUNTRIES: { code: string; label: string }[] = [
  { code: "+57", label: "🇨🇴 +57" },
  { code: "+1", label: "🇺🇸 +1" },
  { code: "+52", label: "🇲🇽 +52" },
  { code: "+58", label: "🇻🇪 +58" },
  { code: "+593", label: "🇪🇨 +593" },
  { code: "+51", label: "🇵🇪 +51" },
  { code: "+507", label: "🇵🇦 +507" },
  { code: "+506", label: "🇨🇷 +506" },
  { code: "+54", label: "🇦🇷 +54" },
  { code: "+56", label: "🇨🇱 +56" },
  { code: "+34", label: "🇪🇸 +34" },
]

/** "316 428 7900" + "+57" → "+573164287900". A number typed with its own "+" wins. */
export function withCountry(code: string, raw: string): string {
  const t = (raw || "").trim()
  if (!t) return ""
  if (t.startsWith("+")) return t
  let digits = t.replace(/\D/g, "")
  if (!digits) return ""
  const cc = code.replace(/\D/g, "")
  if (t.startsWith("00")) return `+${digits.slice(2)}`
  // Typed the country code without the "+" (e.g. "57 316 428 7900").
  if (digits.startsWith(cc) && digits.length > 10) return `+${digits}`
  digits = digits.replace(/^0+/, "")
  return `${code}${digits}`
}
