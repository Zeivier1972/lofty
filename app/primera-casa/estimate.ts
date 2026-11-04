/**
 * "¿Cuánta casa puedo comprar?" — the estimate the /primera-casa quiz shows.
 *
 * A planning range, not a pre-approval. It uses the debt-to-income limits
 * lenders commonly work with: a comfortable payment at 28% of gross monthly
 * income (36% with debts) and a stretch payment at 31% (43% with debts, the
 * usual FHA ceiling). The payment covers principal + interest on a 30-year
 * loan plus an allowance for property tax, homeowner's insurance and mortgage
 * insurance, which in Florida is a large share of the payment.
 *
 * The interest rate is an ASSUMPTION per credit band, shown on screen as one
 * ("tasa supuesta"), never as a quote — rates change daily.
 */

export type CreditBand = "740 o más" | "680 – 739" | "620 – 679" | "580 – 619" | "Menos de 580" | "No lo sé"

export const CREDIT_BANDS: CreditBand[] = ["740 o más", "680 – 739", "620 – 679", "580 – 619", "Menos de 580", "No lo sé"]

/** Assumed 30-year rate for each band (annual %). Edit here when the market moves. */
export const ASSUMED_RATE: Record<CreditBand, number> = {
  "740 o más": 6.25,
  "680 – 739": 6.5,
  "620 – 679": 6.875,
  "580 – 619": 7.25,
  "Menos de 580": 7.5,
  "No lo sé": 6.875,
}

/** Property tax + insurance + mortgage insurance, as a yearly share of the price. */
export const ESCROW_RATE = 0.03
/** Closing costs as a share of the price (Florida buyers usually pay 2–5%). */
export const CLOSING_RATE = 0.03

export type EstimateInput = {
  annualIncome: number
  monthlyDebts: number
  savings: number
  credit: CreditBand
}

export type Estimate = {
  /** Comfortable price (28/36). */
  priceLow: number
  /** Stretch price (31/43). */
  priceHigh: number
  /** Monthly payment at the stretch price. */
  monthlyHigh: number
  /** Monthly payment at the comfortable price. */
  monthlyLow: number
  rate: number
  downPct: number
  /** Down payment + estimated closing costs at the comfortable price. */
  cashNeeded: number
  /** Savings cover the cash needed at the comfortable price. */
  savingsCover: boolean
  /** Credit below what most first-time-buyer loans accept. */
  creditWork: boolean
  /** Too little room in the budget to estimate a price. */
  tooLow: boolean
}

const round5k = (n: number) => Math.max(0, Math.round(n / 5000) * 5000)

/** Monthly principal + interest per dollar borrowed, 30-year fixed. */
function piFactor(annualRatePct: number): number {
  const r = annualRatePct / 100 / 12
  return r / (1 - Math.pow(1 + r, -360))
}

export function estimate(i: EstimateInput): Estimate {
  const monthlyIncome = Math.max(0, i.annualIncome) / 12
  const debts = Math.max(0, i.monthlyDebts)
  const rate = ASSUMED_RATE[i.credit] ?? 6.875
  const creditWork = i.credit === "Menos de 580"
  // FHA's 3.5% minimum needs a 580+ score; below that plan on 10%.
  const downPct = creditWork ? 0.1 : 0.035

  const comfortable = Math.max(0, Math.min(monthlyIncome * 0.28, monthlyIncome * 0.36 - debts))
  const stretch = Math.max(0, Math.min(monthlyIncome * 0.31, monthlyIncome * 0.43 - debts))

  // Price P such that P·(1−dp)·factor + P·escrow/12 = payment.
  const perDollar = (1 - downPct) * piFactor(rate) + ESCROW_RATE / 12
  const priceLow = round5k(comfortable / perDollar)
  const priceHigh = Math.max(priceLow, round5k(stretch / perDollar))

  const monthlyAt = (price: number) => Math.round(price * perDollar)
  const cashNeeded = Math.round(priceLow * (downPct + CLOSING_RATE))

  return {
    priceLow,
    priceHigh,
    monthlyLow: monthlyAt(priceLow),
    monthlyHigh: monthlyAt(priceHigh),
    rate,
    downPct,
    cashNeeded,
    savingsCover: i.savings >= cashNeeded,
    creditWork,
    tooLow: priceHigh < 50000,
  }
}

export const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`
