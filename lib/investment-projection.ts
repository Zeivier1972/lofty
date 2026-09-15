import { Assumptions, analyze, monthlyPayment } from "@/lib/investment-analysis"

// Year-by-year projection and exit analysis. The five indicators describe one
// year; a buyer deciding between projects is really asking "where am I in five
// years, and what do I walk away with if I sell?"

export type ProjectionInputs = {
  years: number
  /** Resale appreciation once delivered — NOT the developer's price-list bump. */
  marketAppreciationPct: number
  rentGrowthPct: number
  expenseGrowthPct: number
  /** Commission plus doc stamps and seller closing costs. */
  sellingCostPct: number
}

export const PROJECTION_DEFAULTS: ProjectionInputs = {
  years: 10,
  marketAppreciationPct: 2,   // Miami resale is near flat right now; be honest.
  rentGrowthPct: 3,
  expenseGrowthPct: 3,
  sellingCostPct: 7,
}

export type ProjectionYear = {
  year: number
  propertyValue: number
  grossRent: number
  operatingExpenses: number
  noi: number
  mortgagePaid: number
  cashFlow: number
  cumulativeCashFlow: number
  loanBalance: number
  equity: number
  /** Net to the seller after costs and paying off the loan. */
  netSaleProceeds: number
  /** Everything back in the buyer's pocket, minus everything they put in. */
  totalProfitIfSold: number
  /** Annualized return on the cash actually invested. */
  annualizedReturnPct: number
}

function remainingBalance(principal: number, annualRatePct: number, years: number, monthsPaid: number): number {
  const r = annualRatePct / 100 / 12
  const pay = monthlyPayment(principal, annualRatePct, years)
  let balance = principal
  for (let i = 0; i < monthsPaid && balance > 0; i++) {
    balance -= pay - balance * r
  }
  return Math.max(balance, 0)
}

export function project(a: Assumptions, p: ProjectionInputs = PROJECTION_DEFAULTS): ProjectionYear[] {
  const base = analyze(a)
  // Cash actually out of pocket: the down payment plus closing costs.
  const invested = base.downPayment + base.closingCosts
  const rows: ProjectionYear[] = []

  let cumulative = 0
  for (let y = 1; y <= p.years; y++) {
    const growth = (pct: number) => Math.pow(1 + pct / 100, y - 1)

    // Value starts from the delivered price, then tracks the resale market.
    const propertyValue = base.appreciatedValue * Math.pow(1 + p.marketAppreciationPct / 100, y - 1)
    const grossRent = base.operatingIncome * 12 * growth(p.rentGrowthPct)
    const operatingExpenses = base.operatingExpenses * 12 * growth(p.expenseGrowthPct)
    const noi = grossRent - operatingExpenses
    const mortgagePaid = base.mortgage * 12
    const cashFlow = noi - mortgagePaid
    cumulative += cashFlow

    const loanBalance = remainingBalance(base.financed, a.mortgageRatePct, a.mortgageYears, y * 12)
    const equity = propertyValue - loanBalance
    const netSaleProceeds = propertyValue * (1 - p.sellingCostPct / 100) - loanBalance
    const totalProfitIfSold = netSaleProceeds + cumulative - invested
    const multiple = (netSaleProceeds + cumulative) / invested
    const annualizedReturnPct = invested > 0 && multiple > 0
      ? (Math.pow(multiple, 1 / y) - 1) * 100
      : 0

    rows.push({
      year: y, propertyValue, grossRent, operatingExpenses, noi, mortgagePaid,
      cashFlow, cumulativeCashFlow: cumulative, loanBalance, equity,
      netSaleProceeds, totalProfitIfSold, annualizedReturnPct,
    })
  }
  return rows
}

// ─── Selling the contract before closing ────────────────────────────────────
// The preconstruction play most Colombian buyers are actually asking about:
// pay the deposits, never close, sell the contract at delivery. Returns are
// dramatic because only the deposits are at risk — but most developers restrict
// or fee assignments, so this is always presented with that caveat.

export type AssignmentScenario = {
  depositsPaid: number
  contractPrice: number
  valueAtDelivery: number
  grossGain: number
  assignmentFee: number
  netGain: number
  returnOnDepositsPct: number
  caveat: string
}

export function assignmentScenario(a: Assumptions, assignmentFeePct = 2): AssignmentScenario {
  const base = analyze(a)
  const depositsPaid = base.downPayment
  const valueAtDelivery = base.appreciatedValue
  const grossGain = valueAtDelivery - a.price
  const assignmentFee = valueAtDelivery * (assignmentFeePct / 100)
  const netGain = grossGain - assignmentFee
  return {
    depositsPaid,
    contractPrice: a.price,
    valueAtDelivery,
    grossGain,
    assignmentFee,
    netGain,
    returnOnDepositsPct: depositsPaid > 0 ? (netGain / depositsPaid) * 100 : 0,
    caveat: "Casi todos los desarrolladores restringen o cobran la cesión de contrato, y algunos la prohíben hasta cerrar. Verifica la cláusula ANTES de vendérselo así a un cliente.",
  }
}
