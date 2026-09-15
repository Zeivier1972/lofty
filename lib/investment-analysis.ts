// The investment model Catherine works from — the five indicators and their
// benchmark ranges, per the Álvaro Rojas coaching sheet. Pure arithmetic so it
// can be unit-checked and reused by the API, the workbook builder and the
// Investment Advisor's tool.

export type Assumptions = {
  price: number
  sqft: number
  downPaymentPct: number       // 0.40 = 40%
  nightlyRate: number
  occupancyPct: number         // 70 = 70%
  mortgageRatePct: number      // 6.5
  mortgageYears: number        // 30
  propertyMgmtPct: number      // 0.20
  taxRatePct: number           // 1.8 (annual, % of price)
  hoaPerSqft: number           // 1.8 ($/sqft/month)
  insuranceMonthly: number
  closingCostPct: number       // 5.4
  appreciationPerPeriodPct: number // 4 (per price-list release)
  appreciationPeriods: number
  copRateAtPurchase?: number
  copRateToday?: number
}

export const DEFAULTS: Omit<Assumptions, "price" | "sqft"> = {
  downPaymentPct: 0.4,
  nightlyRate: 280,
  occupancyPct: 70,
  mortgageRatePct: 6.5,
  mortgageYears: 30,
  propertyMgmtPct: 0.2,
  taxRatePct: 1.8,
  hoaPerSqft: 1.8,
  insuranceMonthly: 100,
  closingCostPct: 5.4,
  appreciationPerPeriodPct: 4,
  appreciationPeriods: 2,
}

export type Band = "Bajo" | "Aceptable" | "Bueno" | "Muy Bueno"

// The ranges from the coaching sheet. Each entry is [upper bound exclusive, label];
// the final band has no upper bound.
const BANDS: Record<"cashOnCash" | "roi" | "capRate", Array<[number, Band]>> = {
  cashOnCash: [[6, "Bajo"], [8, "Aceptable"], [10, "Bueno"]],
  roi: [[5, "Bajo"], [10, "Aceptable"], [15, "Bueno"]],
  capRate: [[4, "Bajo"], [6, "Aceptable"], [8, "Bueno"]],
}

export function band(kind: keyof typeof BANDS, pct: number): Band {
  for (const [limit, label] of BANDS[kind]) if (pct < limit) return label
  return "Muy Bueno"
}

export const BAND_LEGEND: Record<keyof typeof BANDS, string> = {
  cashOnCash: "<6% Bajo · 6-8% Aceptable · 8-10% Bueno · >10% Muy Bueno",
  roi: "<5% Bajo · 5-10% Aceptable · 10-15% Bueno · >15% Muy Bueno",
  capRate: "<4% Bajo · 4-6% Aceptable · 6-8% Bueno · >8% Muy Bueno",
}

/** Level monthly payment for a fully amortizing loan. */
export function monthlyPayment(principal: number, annualRatePct: number, years: number): number {
  if (principal <= 0) return 0
  const r = annualRatePct / 100 / 12
  const n = years * 12
  if (r === 0) return principal / n
  const g = Math.pow(1 + r, n)
  return (principal * r * g) / (g - 1)
}

/** Principal actually retired over the first 12 payments — this is equity, not cost. */
export function firstYearPrincipal(principal: number, annualRatePct: number, years: number): number {
  const r = annualRatePct / 100 / 12
  const pay = monthlyPayment(principal, annualRatePct, years)
  let balance = principal
  for (let i = 0; i < 12 && balance > 0; i++) {
    const interest = balance * r
    balance -= pay - interest
  }
  return principal - Math.max(balance, 0)
}

export type Analysis = ReturnType<typeof analyze>

export function analyze(a: Assumptions) {
  const downPayment = a.price * a.downPaymentPct
  const financed = a.price - downPayment

  const nightsPerMonth = 30 * (a.occupancyPct / 100)
  const operatingIncome = a.nightlyRate * nightsPerMonth

  const propertyMgmt = operatingIncome * a.propertyMgmtPct
  const taxes = (a.price * (a.taxRatePct / 100)) / 12
  const hoa = a.sqft * a.hoaPerSqft
  const insurance = a.insuranceMonthly
  const operatingExpenses = propertyMgmt + taxes + hoa + insurance

  const mortgage = monthlyPayment(financed, a.mortgageRatePct, a.mortgageYears)
  const totalExpenses = operatingExpenses + mortgage

  const noiMonth = operatingIncome - operatingExpenses
  const noiYear = noiMonth * 12
  const cashFlowMonth = operatingIncome - totalExpenses
  const cashFlowYear = cashFlowMonth * 12

  const closingCosts = a.price * (a.closingCostPct / 100)
  const principalYear = firstYearPrincipal(financed, a.mortgageRatePct, a.mortgageYears)

  // Price-list appreciation compounded over the releases until delivery.
  const appreciatedValue = a.price * Math.pow(1 + a.appreciationPerPeriodPct / 100, a.appreciationPeriods)
  const appreciation = appreciatedValue - a.price

  const cashOnCashPct = downPayment > 0 ? (cashFlowYear / downPayment) * 100 : 0
  const roiPct = downPayment > 0
    ? ((cashFlowYear + appreciation + principalYear - closingCosts) / downPayment) * 100
    : 0
  const capRatePct = a.price > 0 ? (noiYear / a.price) * 100 : 0

  // The currency swing a Colombian buyer captures — invisible to every other
  // indicator, and often the largest single number in the deal.
  let cop: { atPurchase: number; today: number; gain: number; gainPct: number } | null = null
  if (a.copRateAtPurchase && a.copRateToday && a.copRateToday > 0) {
    const atPurchase = a.price * a.copRateAtPurchase
    const today = a.price * a.copRateToday
    cop = { atPurchase, today, gain: atPurchase - today, gainPct: ((atPurchase - today) / atPurchase) * 100 }
  }

  return {
    assumptions: a,
    downPayment, financed, nightsPerMonth, operatingIncome,
    propertyMgmt, taxes, hoa, insurance, operatingExpenses,
    mortgage, totalExpenses,
    noiMonth, noiYear, cashFlowMonth, cashFlowYear,
    closingCosts, principalYear, appreciatedValue, appreciation,
    cashOnCashPct, roiPct, capRatePct,
    cashOnCashBand: band("cashOnCash", cashOnCashPct),
    roiBand: band("roi", roiPct),
    capRateBand: band("capRate", capRatePct),
    cop,
  }
}
