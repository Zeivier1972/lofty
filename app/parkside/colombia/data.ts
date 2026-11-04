/**
 * Facts the /parkside/colombia funnel uses. Same source as /parkside:
 * the developer's availability sheet dated 2026-10-27 ("desde" prices) and
 * the deposit schedule. Keep in step with app/parkside/page.tsx and
 * lib/project-knowledge.ts when the developer sends a new sheet.
 */

export const PRICES_AS_OF = "27 de octubre de 2026"

export type UnitType = "Estudio" | "1 habitación" | "2 habitaciones"

export const UNITS: { type: UnitType; from: number; size: string }[] = [
  { type: "Estudio", from: 490000, size: "39 – 47 m²" },
  { type: "1 habitación", from: 582750, size: "45 – 64 m²" },
  { type: "2 habitaciones", from: 1160250, size: "78 – 92 m²" },
]

export const DEPOSITS: { pct: number; when: string }[] = [
  { pct: 20, when: "Al firmar el contrato" },
  { pct: 10, when: "Enero de 2027" },
  { pct: 10, when: "Abril de 2027" },
  { pct: 60, when: "Al cierre · entrega estimada 1er trimestre de 2028" },
]

export const CONTRACT_PCT = DEPOSITS[0].pct / 100

export const usd = (n: number) => `US$${Math.round(n).toLocaleString("en-US")}`

/** Capital available today, by answer (midpoint used to size the plan). */
export const CAPITAL: [string, number][] = [
  ["Menos de US$50,000", 35000],
  ["US$50,000 – US$100,000", 75000],
  ["US$100,000 – US$150,000", 125000],
  ["US$150,000 – US$250,000", 200000],
  ["Más de US$250,000", 300000],
]

export const GOALS = ["Renta / inversión", "Vivienda propia o vacacional", "Ambas", "Diversificar patrimonio en dólares"]
export const PREFS = ["Estudio", "1 habitación", "2 habitaciones", "Aún no lo sé"]
export const CLOSING = ["Contado", "Financiamiento hipotecario", "Venta de otro activo", "Aún no lo sé"]
export const TIMING = ["En los próximos 30 días", "En 1 a 3 meses", "En 3 a 6 meses", "Solo estoy explorando"]
export const US_BEFORE = ["Sí", "No, sería mi primera"]

/**
 * A: ready — the capital covers the 20% contract deposit of what they want
 *    (or at least a studio) and they plan to decide within 6 months.
 * B: close — capital is near the studio deposit, or it fits but they are
 *    only exploring. Still offered the call.
 * C: not yet — well under the smallest contract deposit. Sent to the weekly
 *    webinar first; the call is still there if they want it.
 */
export type Tier = "A" | "B" | "C"

export type Plan = {
  unit: (typeof UNITS)[number]
  /** The type they asked for, when it does not fit their capital. */
  wantedButShort: UnitType | null
  schedule: { pct: number; when: string; amount: number }[]
  beforeClosing: number
  tier: Tier
}

export function buildPlan(capital: number, pref: string, timing: string): Plan {
  const affordable = UNITS.filter(u => u.from * CONTRACT_PCT <= capital)
  const wanted = UNITS.find(u => u.type === pref)
  const fits = !!wanted && affordable.includes(wanted)
  // What they asked for if it fits; otherwise the best that fits (or a studio).
  const planUnit = fits ? wanted! : (affordable[affordable.length - 1] || UNITS[0])
  const wantedButShort = wanted && !fits ? wanted.type : null

  const schedule = DEPOSITS.map(d => ({ ...d, amount: (planUnit.from * d.pct) / 100 }))
  const beforeClosing = schedule.slice(0, -1).reduce((s, x) => s + x.amount, 0)

  const studioDeposit = UNITS[0].from * CONTRACT_PCT
  const exploring = timing === "Solo estoy explorando"
  const tier: Tier =
    capital >= studioDeposit && !exploring ? "A" :
    capital >= studioDeposit * 0.6 ? "B" :
    "C"

  return { unit: planUnit, wantedButShort, schedule, beforeClosing, tier }
}
