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

/** Lets people keep going without telling a stranger their capital. */
export const CAPITAL_PRIVATE = "Prefiero hablarlo en la conversación"
export const CAPITAL_LABELS = [...CAPITAL.map(c => c[0]), CAPITAL_PRIVATE]

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

/** capital null = they preferred not to say: show what they asked for, tier B (capital to confirm on the call). */
export function buildPlan(capital: number | null, pref: string, timing: string): Plan {
  const affordable = capital === null ? UNITS : UNITS.filter(u => u.from * CONTRACT_PCT <= capital)
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
    capital === null ? "B" :
    capital >= studioDeposit && !exploring ? "A" :
    capital >= studioDeposit * 0.6 ? "B" :
    "C"

  return { unit: planUnit, wantedButShort, schedule, beforeClosing, tier }
}

/**
 * Short-term-rental market data for Brickell (studios + 1 bedroom), from
 * PriceLabs' market index: official Brickell boundary, ~1,000 active
 * listings, November 2025 – October 2026. Refresh from PriceLabs
 * (market_research) every few months and update MARKET_AS_OF.
 *
 * This is the MARKET, not Parkside: there is no operating history for a
 * building under construction. The page says so next to every number.
 */
export const MARKET = {
  asOf: "noviembre 2025 – octubre 2026",
  source: "PriceLabs, índice de alquiler a corto plazo de Brickell (estudios y 1 habitación, ~1,000 anuncios activos)",
  occupancy: 63.3,
  adr: 229.57,
  peak: "enero a marzo: 76–81% de ocupación y US$264–296 por noche",
  low: "octubre: 34% de ocupación",
}

/** Square feet used for the HOA assumption, by type (middle of the developer's range). */
export const SQFT: Record<UnitType, number> = { "Estudio": 460, "1 habitación": 590, "2 habitaciones": 920 }

export type RentInputs = {
  price: number
  occupancy: number         // %
  adr: number               // USD per night
  mgmtPct: number           // % of gross rent (operator / platform / cleaning coordination)
  hoaMonthly: number        // USD
  taxPct: number            // property tax, % of price per year
  insuranceYear: number     // USD (unit policy; the master policy is in the HOA)
  electricityMonthly: number
  /** null = paid in cash. */
  financing: { downPct: number; ratePct: number; years: number } | null
  closingPct: number        // closing costs, % of price
}

export type RentResult = {
  gross: number
  mgmt: number
  hoa: number
  tax: number
  insurance: number
  electricity: number
  /** Income after operating costs, before any mortgage. */
  noi: number
  /** Yearly mortgage payment (principal + interest), 0 when paid in cash. */
  debt: number
  /** What lands in the owner's pocket: NOI − mortgage. */
  net: number
  /** Down payment (or full price) + closing costs. */
  cashIn: number
  /** net / cashIn, %. With financing this is the cash-on-cash return. */
  cashOnCash: number
}

function yearlyPayment(loan: number, ratePct: number, years: number): number {
  if (loan <= 0) return 0
  const r = ratePct / 100 / 12
  const n = years * 12
  return r === 0 ? loan / years : (loan * r / (1 - Math.pow(1 + r, -n))) * 12
}

export function rentScenario(i: RentInputs): RentResult {
  const gross = 365 * (i.occupancy / 100) * i.adr
  const mgmt = gross * (i.mgmtPct / 100)
  const hoa = i.hoaMonthly * 12
  const tax = i.price * (i.taxPct / 100)
  const insurance = i.insuranceYear
  const electricity = i.electricityMonthly * 12
  const noi = gross - mgmt - hoa - tax - insurance - electricity
  const down = i.financing ? i.price * (i.financing.downPct / 100) : i.price
  const debt = i.financing ? yearlyPayment(i.price - down, i.financing.ratePct, i.financing.years) : 0
  const net = noi - debt
  const cashIn = down + i.price * (i.closingPct / 100)
  return { gross, mgmt, hoa, tax, insurance, electricity, noi, debt, net, cashIn, cashOnCash: cashIn ? (net / cashIn) * 100 : 0 }
}

/**
 * Parkside cost assumptions, from Catherine's Parkside STR calculators
 * (docs/parkside/STR_CALCULATOR_*.xlsx): HOA US$1.70 per sq ft per month
 * (includes water, internet, cable, master insurance and valet parking),
 * property tax 1.7%, closing costs 4.5%, electricity US$400/month, bank
 * financing at 6.5% over 30 years with the developer's preferred lenders.
 * Every one is editable on the page.
 */
export const DEFAULTS = {
  mgmtPct: 25,
  hoaPerSqft: 1.7,
  taxPct: 1.7,
  insuranceYear: 600,
  electricityMonthly: 400,
  closingPct: 4.5,
  downPct: 40,
  ratePct: 6.5,
  years: 30,
}

/** The two starting points the visitor can switch between. */
export const SCENARIOS = {
  market: {
    label: "Mercado de Brickell hoy",
    occupancy: Math.round(MARKET.occupancy),
    adr: Math.round(MARKET.adr / 5) * 5,
    note: `Datos reales de alquiler a corto plazo en Brickell (${MARKET.asOf}).`,
  },
  investor: {
    label: "Escenario de un inversionista",
    occupancy: 75,
    adr: 375,
    note: "Proyección que nos compartió un inversionista que analiza el proyecto (75% de ocupación, US$375 por noche, para una residencia nueva con servicio de hotel). Es más optimista que el promedio actual del mercado.",
  },
} as const

/**
 * Financing for foreign buyers, per Catherine: US banks lend to
 * international investors; the buyer usually puts in about 50% of the
 * price, and on some projects less. In Parkside the deposits are 40% and
 * Catherine's calculators finance the other 60% at closing with the
 * developer's preferred lenders. Terms depend on the bank and profile.
 */
export const FINANCING = { ownPct: 40, typicalPct: 50 }

/** Catherine's Parkside interview (Cloudinary), exactly as uploaded. */
export const VIDEO = {
  src: "https://res.cloudinary.com/dhqolxzne/video/upload/v1793815172/park_side_interview_final_20261103_1707_hitfkj.mp4",
  poster: "https://res.cloudinary.com/dhqolxzne/video/upload/so_2,q_auto,w_1280/v1793815172/park_side_interview_final_20261103_1707_hitfkj.jpg",
  uploaded: "2026-11-04",
}
