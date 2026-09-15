export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Assumptions, DEFAULTS, analyze } from "@/lib/investment-analysis"
import { buildInvestmentWorkbook } from "@/lib/investment-workbook"
import { resolveStrAssumptions, lookupAppreciation, isLongTermPlay, lookupLongTermComp, STR_ASOF } from "@/lib/str-market-data"

const num = (v: any): number | undefined => {
  if (v === null || v === undefined || v === "") return undefined
  const n = Number(String(v).replace(/[$,%\s]/g, ""))
  return Number.isFinite(n) ? n : undefined
}

// Pull "$1.8/sqft", "HOA de $1.70/sqft" etc. out of the free text Catherine
// typed on the Pre-Construction page, so the sheet starts from the project's
// real HOA instead of the generic default.
function hoaFromText(text: string | undefined): number | undefined {
  if (!text) return undefined
  const m = text.match(/\$\s?(\d+(?:\.\d+)?)\s?(?:por|\/)\s?(?:sqft|sq\s?ft|pie|ft)/i)
  const v = m ? Number(m[1]) : NaN
  return Number.isFinite(v) && v > 0 && v < 20 ? v : undefined
}

async function resolve(params: Record<string, any>) {
  let project: any = null
  const wanted = (params.projectId || params.project || "").toString().trim()
  if (wanted) {
    const row = await prisma.setting.findUnique({ where: { key: "preconstruction_projects" } })
    if (row) {
      try {
        const all: any[] = JSON.parse(row.value)
        project = all.find(p => p.id === wanted)
          || all.find(p => p.name.toLowerCase() === wanted.toLowerCase())
          || all.find(p => p.name.toLowerCase().includes(wanted.toLowerCase()))
          || null
      } catch {}
    }
    if (!project) return { error: `No encontré el proyecto "${wanted}" en la cartera.` }
  }

  const price = num(params.price) ?? project?.priceMin
  const sqft = num(params.sqft)
  if (!price) return { error: "Falta el precio (price) — el proyecto no tiene priceMin y no se envió uno." }
  if (!sqft) return { error: "Falta la superficie en pies cuadrados (sqft). Sin ella no se puede calcular el HOA." }

  // Real numbers for this building, or its submarket, or Florida — in that
  // order. The generic default is the last resort, never the first choice.
  const longTerm = isLongTermPlay(project?.propertyType, project?.name || String(params.name || ""))
  const ltComp = longTerm ? lookupLongTermComp(project?.name || String(params.name || "")) : null
  const mkt = resolveStrAssumptions(project?.name || params.name, project?.neighborhood, project?.city)
  const apr = lookupAppreciation(project?.neighborhood, project?.city)

  const assumptions: Assumptions = {
    ...DEFAULTS,
    price,
    sqft,
    hoaPerSqft: num(params.hoaPerSqft)
      ?? hoaFromText(project?.description)
      ?? hoaFromText(project?.investmentHighlights)
      ?? DEFAULTS.hoaPerSqft,
    downPaymentPct: num(params.downPaymentPct) ?? DEFAULTS.downPaymentPct,
    nightlyRate: num(params.nightlyRate)
      ?? (longTerm ? (num(params.monthlyRent) ?? ltComp?.monthlyRent ?? 0) / 30 : mkt.adr),
    occupancyPct: num(params.occupancyPct) ?? (longTerm ? 100 : mkt.occupancyPct),
    mortgageRatePct: num(params.mortgageRatePct) ?? DEFAULTS.mortgageRatePct,
    mortgageYears: num(params.mortgageYears) ?? DEFAULTS.mortgageYears,
    propertyMgmtPct: num(params.propertyMgmtPct) ?? DEFAULTS.propertyMgmtPct,
    taxRatePct: num(params.taxRatePct) ?? DEFAULTS.taxRatePct,
    insuranceMonthly: num(params.insuranceMonthly) ?? DEFAULTS.insuranceMonthly,
    closingCostPct: num(params.closingCostPct) ?? DEFAULTS.closingCostPct,
    appreciationPerPeriodPct: num(params.appreciationPerPeriodPct) ?? DEFAULTS.appreciationPerPeriodPct,
    appreciationPeriods: num(params.appreciationPeriods) ?? DEFAULTS.appreciationPeriods,
    copRateAtPurchase: num(params.copRateAtPurchase),
    copRateToday: num(params.copRateToday),
  }

  const notes: string[] = []
  if (longTerm) {
    const rent = num(params.monthlyRent) ?? ltComp?.monthlyRent
    if (!rent && !num(params.nightlyRate)) {
      return { error: "Este proyecto es de renta larga (casa o townhouse). Envía la renta mensual esperada en monthlyRent — una tarifa por noche no aplica." }
    }
    notes.push(`Renta LARGA, no corta: se modela con la renta mensual${ltComp ? ` de $${ltComp.monthlyRent.toLocaleString()} (${ltComp.source})` : ""}, no con tarifa por noche. No le apliques ocupación de Airbnb a esta propiedad.`)
  }
  const usedMarketDefaults = !longTerm && (num(params.nightlyRate) === undefined || num(params.occupancyPct) === undefined)
  if (usedMarketDefaults) {
    const levelLabel = mkt.level === "building"
      ? "dato del edificio"
      : mkt.level === "submarket" ? "promedio del submercado" : "línea base del estado"
    notes.push(`Tarifa y ocupación: ${mkt.label} — $${mkt.adr}/noche al ${mkt.occupancyPct}% (${levelLabel}, ${mkt.source}, datos a ${STR_ASOF})`)
    if (mkt.note) notes.push(mkt.note)
  }
  if (apr) {
    notes.push(`Valorización de reventa en la zona: ${apr.marketYoYPct}% interanual (${apr.source}). Es distinta del ${DEFAULTS.appreciationPerPeriodPct}% por lista de precios del desarrollador que usa el modelo: ese lo captura el comprador en preconstrucción por haber firmado al precio viejo.`)
    if (apr.note) notes.push(apr.note)
  }
  if (project) {
    if (project.developer) notes.push(`Desarrollador: ${project.developer}`)
    if (project.deliveryDate) notes.push(`Entrega: ${project.deliveryDate}`)
    if (project.estimatedROI) notes.push(`ROI que declara el desarrollador: ${project.estimatedROI}`)
  }
  if (params.notes) notes.push(...String(params.notes).split("|").map(s => s.trim()).filter(Boolean))

  const sources = params.sources
    ? String(params.sources).split("|").map(s => s.trim()).filter(Boolean)
    : []

  return {
    project,
    assumptions,
    name: project?.name || String(params.name || "Análisis de inversión"),
    unitLabel: params.unitLabel ? String(params.unitLabel) : project?.bedrooms,
    paymentSchedule: params.paymentSchedule ? String(params.paymentSchedule) : project?.downPayment,
    notes,
    sources,
  }
}

async function respond(params: Record<string, any>) {
  const r = await resolve(params)
  if ("error" in r && r.error) return NextResponse.json({ error: r.error }, { status: 400 })

  // ?format=json returns the numbers instead of the file, so the Investment
  // Advisor can quote them in chat and link the workbook separately.
  if (String(params.format || "").toLowerCase() === "json") {
    const a = analyze(r.assumptions!)
    return NextResponse.json({
      project: r.name,
      assumptions: r.assumptions,
      indicators: {
        noiMonth: Math.round(a.noiMonth), noiYear: Math.round(a.noiYear),
        cashFlowMonth: Math.round(a.cashFlowMonth), cashFlowYear: Math.round(a.cashFlowYear),
        cashOnCash: { pct: +a.cashOnCashPct.toFixed(2), band: a.cashOnCashBand },
        roi: { pct: +a.roiPct.toFixed(2), band: a.roiBand },
        capRate: { pct: +a.capRatePct.toFixed(2), band: a.capRateBand },
      },
      detail: {
        downPayment: Math.round(a.downPayment), financed: Math.round(a.financed),
        operatingIncome: Math.round(a.operatingIncome),
        operatingExpenses: Math.round(a.operatingExpenses),
        mortgage: Math.round(a.mortgage), totalExpenses: Math.round(a.totalExpenses),
        closingCosts: Math.round(a.closingCosts), principalYear: Math.round(a.principalYear),
        appreciation: Math.round(a.appreciation), appreciatedValue: Math.round(a.appreciatedValue),
        cop: a.cop,
      },
    })
  }

  const buffer = await buildInvestmentWorkbook({
    projectName: r.name!,
    unitLabel: r.unitLabel,
    assumptions: r.assumptions!,
    paymentSchedule: r.paymentSchedule,
    notes: r.notes,
    sources: r.sources,
  })

  const safe = r.name!.replace(/[^a-z0-9\-_ ]/gi, "").trim().replace(/\s+/g, "-") || "analisis"
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Analisis-${safe}.xlsx"`,
      "Cache-Control": "no-store",
    },
  })
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { searchParams } = new URL(req.url)
  return respond(Object.fromEntries(searchParams.entries()))
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
  return respond(body || {})
}
