import { Assumptions, DEFAULTS, analyze } from "@/lib/investment-analysis"
import { project, assignmentScenario, PROJECTION_DEFAULTS, ProjectionInputs } from "@/lib/investment-projection"
import { resolveStrAssumptions, isLongTermPlay, lookupLongTermComp, lookupAppreciation } from "@/lib/str-market-data"

// Ranking projects against what a specific client actually wants. A buyer who
// needs monthly income and a buyer parking capital for five years are looking
// at the same building and should get different answers.

export type ClientGoal = "flujo" | "valorizacion" | "uso_propio" | "balanceado"

export type ClientProfile = {
  goal: ClientGoal
  /** Cash the client has available, all-in — down payment plus closing costs. */
  capitalAvailable?: number
  budgetMax?: number
  /** Years until they expect to sell. Drives which projection year is scored. */
  horizonYears?: number
}

export const GOAL_LABELS: Record<ClientGoal, string> = {
  flujo: "Flujo de caja mensual",
  valorizacion: "Valorización y salida",
  uso_propio: "Uso propio con renta cuando no lo usa",
  balanceado: "Balanceado",
}

export type Candidate = {
  project: any
  /** Unit size, or the HOA in dollars when size is unknown. */
  sqft?: number
  hoaMonthly?: number
  price?: number
  monthlyRent?: number
}

export type Scored = {
  name: string
  neighborhood?: string
  price: number
  downPayment: number
  cashNeeded: number
  cashFlowMonth: number
  cashOnCashPct: number
  roiPct: number
  capRatePct: number
  horizonYear: number
  profitIfSold: number
  annualizedPct: number
  assignmentReturnPct: number
  marketLabel: string
  marketSource: string
  longTerm: boolean
  score: number
  fits: boolean
  reasons: string[]
  warnings: string[]
}

/** Weights per goal: [cashOnCash, annualizedAtHorizon, capRate, cashFlow]. */
const WEIGHTS: Record<ClientGoal, [number, number, number, number]> = {
  flujo:         [0.45, 0.10, 0.20, 0.25],
  valorizacion:  [0.10, 0.60, 0.10, 0.20],
  uso_propio:    [0.20, 0.30, 0.20, 0.30],
  balanceado:    [0.30, 0.30, 0.20, 0.20],
}

export function scoreCandidate(c: Candidate, profile: ClientProfile, proj: ProjectionInputs = PROJECTION_DEFAULTS): Scored | null {
  const p = c.project || {}
  const price = c.price ?? p.priceMin
  if (!price) return null
  // A $0 HOA is real data (Verdana has none) — only undefined means "unknown".
  if (!c.sqft && c.hoaMonthly === undefined) return null

  const longTerm = isLongTermPlay(p.propertyType, p.name)
  const ltComp = longTerm ? lookupLongTermComp(p.name) : null
  const monthlyRent = c.monthlyRent ?? ltComp?.monthlyRent
  if (longTerm && !monthlyRent) return null

  const mkt = resolveStrAssumptions(p.name, p.neighborhood, p.city)
  const apr = lookupAppreciation(p.neighborhood, p.city)

  const a: Assumptions = {
    ...DEFAULTS,
    price,
    sqft: c.sqft,
    hoaMonthly: c.hoaMonthly,
    nightlyRate: longTerm ? monthlyRent! / 30 : mkt.adr,
    occupancyPct: longTerm ? 100 : mkt.occupancyPct,
  }

  const base = analyze(a)
  const horizon = Math.max(1, Math.min(profile.horizonYears || 5, proj.years))
  const rows = project(a, { ...proj, marketAppreciationPct: apr?.marketYoYPct ?? proj.marketAppreciationPct })
  const atHorizon = rows[horizon - 1]
  const assign = assignmentScenario(a)

  const cashNeeded = base.downPayment + base.closingCosts

  // Normalize each metric onto a rough 0-1 scale before weighting. The anchors
  // come from the coaching sheet's own "Muy Bueno" thresholds.
  const n = (v: number, good: number) => Math.max(0, Math.min(v / good, 1.5)) / 1.5
  const [wCoC, wAnn, wCap, wFlow] = WEIGHTS[profile.goal]
  const score =
    wCoC * n(base.cashOnCashPct, 10) +
    wAnn * n(atHorizon.annualizedReturnPct, 15) +
    wCap * n(base.capRatePct, 8) +
    wFlow * n(base.cashFlowMonth, 1500)

  const reasons: string[] = []
  const warnings: string[] = []

  if (base.cashFlowMonth > 0) reasons.push(`Se paga solo: deja ${Math.round(base.cashFlowMonth).toLocaleString()} dólares al mes desde el primer año`)
  else warnings.push(`Flujo NEGATIVO de $${Math.abs(Math.round(base.cashFlowMonth)).toLocaleString()} al mes — el cliente pone de su bolsillo`)

  if (base.cashOnCashPct >= 8) reasons.push(`Cash on cash de ${base.cashOnCashPct.toFixed(1)}%, por encima de lo que da un CDT`)
  if (atHorizon.annualizedReturnPct >= 12) reasons.push(`${atHorizon.annualizedReturnPct.toFixed(1)}% anualizado si vende al año ${horizon}`)
  if (mkt.level === "building") reasons.push(`Ocupación real del edificio (${mkt.occupancyPct}%), no un promedio del barrio`)
  if (p.estimatedROI) reasons.push(`El desarrollador declara ${p.estimatedROI}`)
  if (longTerm) reasons.push("Renta larga: menos gestión, ingreso más predecible, sin depender del turismo")

  if (mkt.level === "state") warnings.push("No hay dato de renta corta para esta zona; se usó la línea base de Florida")
  if (apr && apr.marketYoYPct < 2) warnings.push(`La reventa en la zona va en ${apr.marketYoYPct}% interanual — la valorización real hoy es floja`)

  const fitsBudget = profile.budgetMax ? price <= profile.budgetMax : true
  const fitsCapital = profile.capitalAvailable ? cashNeeded <= profile.capitalAvailable : true
  if (!fitsBudget) warnings.push(`Sobre el presupuesto: $${Math.round(price).toLocaleString()} contra $${Math.round(profile.budgetMax!).toLocaleString()}`)
  if (!fitsCapital) warnings.push(`Necesita $${Math.round(cashNeeded).toLocaleString()} en efectivo y el cliente tiene $${Math.round(profile.capitalAvailable!).toLocaleString()}`)

  return {
    name: p.name || "Unidad",
    neighborhood: p.neighborhood || p.city,
    price,
    downPayment: base.downPayment,
    cashNeeded,
    cashFlowMonth: base.cashFlowMonth,
    cashOnCashPct: base.cashOnCashPct,
    roiPct: base.roiPct,
    capRatePct: base.capRatePct,
    horizonYear: horizon,
    profitIfSold: atHorizon.totalProfitIfSold,
    annualizedPct: atHorizon.annualizedReturnPct,
    assignmentReturnPct: assign.returnOnDepositsPct,
    marketLabel: mkt.label,
    marketSource: mkt.source,
    longTerm,
    score,
    fits: fitsBudget && fitsCapital,
    reasons,
    warnings,
  }
}

/** Candidates that fit the client's constraints rank above those that don't. */
export function compare(candidates: Candidate[], profile: ClientProfile, proj?: ProjectionInputs): Scored[] {
  return candidates
    .map(c => scoreCandidate(c, profile, proj))
    .filter((x): x is Scored => x !== null)
    .sort((a, b) => (Number(b.fits) - Number(a.fits)) || (b.score - a.score))
}
