import { SOFLA_CITIES } from "@/lib/sofla-cities"
import { PROPERTY_TYPE_GROUPS } from "@/lib/property-types"

/**
 * Turn one line of free text into the filters /homes already understands.
 *
 * Two callers need this and neither can use the structured filter UI:
 *
 *  - The `SearchAction` in the homepage JSON-LD. Google's sitelinks searchbox,
 *    and the assistants that read the same markup, send a single
 *    `search_term_string` — so the site has to accept one, or the markup is
 *    claiming a search endpoint that ignores what it is given.
 *  - Voice. Nobody dictates a filter form; they say "casas en Doral bajo 500
 *    mil, 3 cuartos".
 *
 * Deliberately conservative. The city is matched against the known city list
 * rather than guessed from leftover words, because a wrong city silently
 * returns an empty result set and looks like broken inventory. Anything it
 * cannot read with confidence it leaves unset, and /homes falls back to its
 * normal unfiltered search.
 */

export interface ParsedSearch {
  city?: string
  minPrice?: string
  maxPrice?: string
  minBeds?: string
  /** Param form of a property-type group key, as `keysToParam` produces. */
  type?: string
}

const strip = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")

/** Words that put the price on one side or the other. */
const MAX_WORDS = /(bajo|menos de|menor a|hasta|maximo|max|under|below|less than|up to|no mas de)/
const MIN_WORDS = /(desde|mas de|mayor a|arriba de|minimo|min|over|above|from|starting at|at least)/

const BED_WORDS = "rec|recamaras?|recs?|cuartos?|habitaciones?|hab|dormitorios?|alcobas?|bedrooms?|beds?|br"

/**
 * Neighbourhoods people say out loud, and the MLS City that actually holds
 * their listings. The homepage already advertises several of these as service
 * areas, so a search for one has to land somewhere real rather than filter on a
 * City value the feed never returns.
 */
const NEIGHBORHOODS: { term: string; city: string }[] = [
  { term: "Brickell", city: "Miami" },
  { term: "Edgewater", city: "Miami" },
  { term: "Wynwood", city: "Miami" },
  { term: "Midtown", city: "Miami" },
  { term: "Downtown Miami", city: "Miami" },
  { term: "Design District", city: "Miami" },
  { term: "Coconut Grove", city: "Miami" },
  { term: "Little Havana", city: "Miami" },
  { term: "South Beach", city: "Miami Beach" },
]

const TYPE_WORDS: { re: RegExp; key: string }[] = [
  { re: /\b(casas?|house|houses|single[\s-]?family|unifamiliar)\b/, key: "single_family" },
  { re: /\b(condos?|condominios?|apartamentos?|apartments?|aptos?|depas?)\b/, key: "condo" },
  { re: /\b(town\s?house[s]?|adosados?)\b/, key: "townhouse" },
]

/**
 * Read a money amount. "500k", "500 mil", "1.2m", "$450,000" and "500.000" all
 * appear in the wild; the magnitude suffix decides whether a dot is a decimal
 * point or a thousands separator.
 */
function parseAmount(raw: string, suffix: string | undefined): number | null {
  const sfx = (suffix || "").trim()
  const isThousands = /^(k|mil)$/.test(sfx)
  const isMillions = /^(m|mm|millon|millones|million|millions)$/.test(sfx)

  let n: number
  if (isThousands || isMillions) {
    n = Number(raw.replace(/,/g, ""))
    if (!Number.isFinite(n)) return null
    n *= isMillions ? 1_000_000 : 1_000
  } else {
    // No suffix: every separator is a thousands separator.
    n = Number(raw.replace(/[.,]/g, ""))
    if (!Number.isFinite(n)) return null
  }

  if (n <= 0) return null
  // A bare "500" means $500,000 to a buyer, not five hundred dollars.
  if (n < 1000) n *= 1000
  // Outside this range it is almost certainly not a price — a year, a zip, a
  // phone number — and guessing wrong is worse than leaving the filter off.
  if (n < 10_000 || n > 100_000_000) return null
  return Math.round(n)
}

export function parseSearchQuery(query: string | null | undefined): ParsedSearch {
  const out: ParsedSearch = {}
  if (!query || !query.trim()) return out
  const q = strip(query)

  // --- bedrooms ---
  const beds = q.match(new RegExp(`(\\d{1,2})\\s*(?:${BED_WORDS})\\b`))
  if (beds) {
    const n = Number(beds[1])
    if (n >= 1 && n <= 10) out.minBeds = String(n)
  }

  // --- price ---
  // Scan every money-looking token with the words just before it, so the
  // direction word binds to the number it actually qualifies.
  const money = /(?:(\$)\s*)?(\d[\d.,]*)\s*(k|mil|mm?|millon(?:es)?|millions?)?\b/g
  for (let m = money.exec(q); m; m = money.exec(q)) {
    const [whole, dollar, digits, suffix] = m
    // Skip the bedroom count we already consumed.
    if (beds && m.index === beds.index) continue
    // A number with no $, no magnitude word and no price word around it is
    // probably not money (a zip, a street number, "3 banos").
    const before = q.slice(Math.max(0, m.index - 24), m.index)
    const hasDirection = MAX_WORDS.test(before) || MIN_WORDS.test(before)
    if (!dollar && !suffix && !hasDirection) continue

    const amount = parseAmount(digits, suffix)
    if (amount === null) continue

    if (MIN_WORDS.test(before) && !MAX_WORDS.test(before)) {
      if (!out.minPrice) out.minPrice = String(amount)
    } else {
      // Default to a ceiling: "500k" from a buyer means "up to 500k".
      if (!out.maxPrice) out.maxPrice = String(amount)
    }
    void whole
  }

  // --- property type ---
  for (const t of TYPE_WORDS) {
    if (t.re.test(q) && PROPERTY_TYPE_GROUPS.some(g => g.key === t.key)) {
      out.type = t.key
      break
    }
  }

  // --- city ---
  // Buyers name neighbourhoods ("Brickell", "South Beach"); the MLS files them
  // under the municipality, so a literal match would filter on a City value the
  // feed never returns. Map them to the city that actually holds the listings.
  const match = (term: string) =>
    new RegExp(`(^|[^a-z])${strip(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(q)

  const candidates: { term: string; city: string }[] = [
    ...SOFLA_CITIES.map(c => ({ term: c.name, city: c.name })),
    { term: "Orlando", city: "Orlando" },
    ...NEIGHBORHOODS,
  ].sort((a, b) => b.term.length - a.term.length) // "Miami Beach" before "Miami"

  for (const c of candidates) {
    if (match(c.term)) {
      out.city = c.city
      break
    }
  }

  return out
}

/** The parsed filters as a query string /homes can consume. */
export function parsedToParams(p: ParsedSearch): string {
  const sp = new URLSearchParams()
  if (p.city) sp.set("city", p.city)
  if (p.minPrice) sp.set("minPrice", p.minPrice)
  if (p.maxPrice) sp.set("maxPrice", p.maxPrice)
  if (p.minBeds) sp.set("minBeds", p.minBeds)
  if (p.type) sp.set("type", p.type)
  return sp.toString()
}
