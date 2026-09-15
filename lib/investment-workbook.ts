import ExcelJS from "exceljs"
import { Assumptions, analyze, BAND_LEGEND } from "@/lib/investment-analysis"
import { EXPLAINERS } from "@/lib/investment-explainers"
import { project, assignmentScenario, PROJECTION_DEFAULTS, ProjectionInputs } from "@/lib/investment-projection"

// Rebuilds Catherine's coaching sheet for any project. Everything downstream of
// the yellow input cells is a live formula, so she can change the nightly rate
// or the down payment in Excel and watch all five indicators move — the same
// way the original sheet worked.

const MONEY = '"$"#,##0'
const MONEY2 = '"$"#,##0.00'
const PCT = "0.00%"
const INPUT_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } }
const TOTAL_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4D6" } }
const HEAD_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } }

export type WorkbookInput = {
  projectName: string
  unitLabel?: string
  assumptions: Assumptions
  /** Free-text payment schedule from the project record, e.g. "20% al contrato · …" */
  paymentSchedule?: string
  notes?: string[]
  sources?: string[]
  projection?: Partial<ProjectionInputs>
}

export async function buildInvestmentWorkbook(input: WorkbookInput): Promise<Buffer> {
  const a = input.assumptions
  const r = analyze(a)

  const wb = new ExcelJS.Workbook()
  wb.creator = "CASAi — Catherine Gomez Realtor"
  wb.created = new Date()

  // Created in reading order: Catherine opens the file on the summary.
  const sum = wb.addWorksheet("Resumen para el cliente")
  const guide = wb.addWorksheet("Cómo explicarlo")
  const proj = wb.addWorksheet("Proyección y venta")
  const ws = wb.addWorksheet("Análisis")
  const tail = wb.addWorksheet("Supuestos y fuentes")
  ws.columns = [
    { width: 4 }, { width: 30 }, { width: 3 }, { width: 16 },
    { width: 3 }, { width: 30 }, { width: 18 }, { width: 14 }, { width: 30 },
  ]

  const label = (cell: string, text: string, bold = false) => {
    ws.getCell(cell).value = text
    if (bold) ws.getCell(cell).font = { bold: true }
  }
  const money = (cell: string, value: ExcelJS.CellValue, fmt = MONEY) => {
    ws.getCell(cell).value = value as any
    ws.getCell(cell).numFmt = fmt
  }
  const section = (cell: string, text: string) => {
    ws.getCell(cell).value = text
    ws.getCell(cell).font = { bold: true, size: 11 }
    ws.getCell(cell).fill = HEAD_FILL
  }
  const input_ = (cell: string) => { ws.getCell(cell).fill = INPUT_FILL }

  // ─── Header ───────────────────────────────────────────────────────────────
  ws.getCell("B2").value = input.projectName
  ws.getCell("B2").font = { bold: true, size: 14 }
  label("B3", input.unitLabel || "Unidad")

  section("B5", "LA UNIDAD")
  label("B6", "Precio");            money("D6", a.price);           input_("D6")
  label("B7", "SFT");               ws.getCell("D7").value = a.sqft ?? ""; input_("D7")
  label("B8", "Mts2");              ws.getCell("D8").value = a.sqft ? ({ formula: "D7*0.093" } as any) : ""
  ws.getCell("D8").numFmt = "0.00"
  label("B9", "% Down payment");    ws.getCell("D9").value = a.downPaymentPct; ws.getCell("D9").numFmt = "0%"; input_("D9")
  label("B10", "Down Payment");     money("D10", { formula: "D6*D9" })
  label("B11", "Banco - Financiamiento"); money("D11", { formula: "D6-D10" })

  // ─── Income ───────────────────────────────────────────────────────────────
  section("B13", "INGRESOS")
  label("B14", "Estimado / noche");  money("D14", a.nightlyRate);    input_("D14")
  label("B15", "% Ocupación");       ws.getCell("D15").value = a.occupancyPct / 100; ws.getCell("D15").numFmt = "0%"; input_("D15")
  label("B16", "Noches / mes");      ws.getCell("D16").value = { formula: "30*D15" } as any
  ws.getCell("D16").numFmt = "0.0"
  label("B17", "Operating Income", true); money("D17", { formula: "D14*D16" })

  // ─── Expenses ─────────────────────────────────────────────────────────────
  section("B19", "GASTOS MENSUALES")
  label("B20", "% Property management"); ws.getCell("D20").value = a.propertyMgmtPct; ws.getCell("D20").numFmt = "0%"; input_("D20")
  label("B21", "Property management");   money("D21", { formula: "D17*D20" })
  label("B22", "% Taxes anual");         ws.getCell("D22").value = a.taxRatePct / 100; ws.getCell("D22").numFmt = "0.00%"; input_("D22")
  label("B23", "Taxes");                 money("D23", { formula: "D6*D22/12" })
  label("B24", "HOA $/sqft");            money("D24", a.hoaPerSqft, MONEY2); input_("D24")
  label("B25", "HOA");                   money("D25", a.hoaMonthly ? a.hoaMonthly : { formula: "D7*D24" })
  if (a.hoaMonthly) input_("D25")
  label("B26", "Insurance");             money("D26", a.insuranceMonthly); input_("D26")
  label("B27", "Operating Expenses", true); money("D27", { formula: "D21+D23+D25+D26" })
  ws.getCell("D27").fill = TOTAL_FILL
  label("B28", `Hipoteca ${a.mortgageRatePct}% a ${a.mortgageYears} años`); money("D28", { formula: "-PMT(D29/12,D30*12,D11)" })
  label("B29", "Tasa hipoteca");   ws.getCell("D29").value = a.mortgageRatePct / 100; ws.getCell("D29").numFmt = "0.00%"; input_("D29")
  label("B30", "Años");            ws.getCell("D30").value = a.mortgageYears; input_("D30")
  label("B31", "Total Expenses", true); money("D31", { formula: "D27+D28" })
  ws.getCell("D31").fill = TOTAL_FILL

  section("B33", "FLUJO")
  label("B34", "Cash Flow Month", true); money("D34", { formula: "D17-D31" })
  label("B35", "Cash Flow Year", true);  money("D35", { formula: "D34*12" })

  // ─── Extra inputs feeding ROI ─────────────────────────────────────────────
  section("B37", "PARA EL ROI")
  label("B38", "% Gastos de cierre"); ws.getCell("D38").value = a.closingCostPct / 100; ws.getCell("D38").numFmt = "0.00%"; input_("D38")
  label("B39", "Gastos de cierre");   money("D39", { formula: "D6*D38" })
  label("B40", "Pago a capital año 1"); money("D40", { formula: "D11-(-FV(D29/12,12,PMT(D29/12,D30*12,D11),D11))" })
  label("B41", "Valorización a la entrega"); money("D41", { formula: "G53-D6" })

  // ─── The five indicators ──────────────────────────────────────────────────
  section("F5", "LOS 5 INDICADORES")

  const indicator = (row: number, title: string, meaning: string, valueFormula: string, fmt: string, legend?: string, bandFormula?: string) => {
    ws.getCell(`F${row}`).value = title
    ws.getCell(`F${row}`).font = { bold: true }
    ws.getCell(`G${row}`).value = { formula: valueFormula } as any
    ws.getCell(`G${row}`).numFmt = fmt
    ws.getCell(`G${row}`).font = { bold: true }
    if (bandFormula) {
      ws.getCell(`H${row}`).value = { formula: bandFormula } as any
      ws.getCell(`H${row}`).font = { bold: true }
    }
    ws.getCell(`F${row + 1}`).value = meaning
    ws.getCell(`F${row + 1}`).font = { size: 9, color: { argb: "FF666666" } }
    if (legend) {
      ws.getCell(`I${row}`).value = legend
      ws.getCell(`I${row}`).font = { size: 9, color: { argb: "FF666666" } }
    }
  }

  indicator(7, "1. NOI mensual", "Ingreso operativo − gastos operativos. Cuánto produce SIN la deuda.", "D17-D27", MONEY)
  indicator(9, "   NOI anual", "", "(D17-D27)*12", MONEY)
  indicator(11, "2. Cash Flow anual", "Cuánto queda después de pagar la deuda.", "D35", MONEY)
  indicator(13, "3. Cash on Cash", "Retorno sobre el capital que el cliente realmente puso.", "D35/D10", PCT,
    BAND_LEGEND.cashOnCash,
    `IF(G13<6%,"Bajo",IF(G13<8%,"Aceptable",IF(G13<10%,"Bueno","Muy Bueno")))`)
  indicator(16, "4. ROI", "Cash flow + valorización + pago a capital − gastos de cierre, sobre el down payment.", "(D35+D41+D40-D39)/D10", PCT,
    BAND_LEGEND.roi,
    `IF(G16<5%,"Bajo",IF(G16<10%,"Aceptable",IF(G16<15%,"Bueno","Muy Bueno")))`)
  indicator(19, "5. Cap Rate", "Rendimiento del inmueble sobre su valor — si la compra 100% de contado.", "(D17-D27)*12/D6", PCT,
    BAND_LEGEND.capRate,
    `IF(G19<4%,"Bajo",IF(G19<6%,"Aceptable",IF(G19<8%,"Bueno","Muy Bueno")))`)

  // ─── Appreciation schedule ────────────────────────────────────────────────
  section("F23", "VALORIZACIÓN ESTIMADA")
  ws.getCell("F24").value = "% por lista de precios"
  ws.getCell("G24").value = a.appreciationPerPeriodPct / 100
  ws.getCell("G24").numFmt = "0.00%"
  input_("G24")
  let row = 25
  for (let i = 0; i <= a.appreciationPeriods; i++) {
    ws.getCell(`F${row}`).value = i === 0 ? "Precio de lista hoy" : `Lista ${i}`
    money(`G${row}`, i === 0 ? { formula: "D6" } : { formula: `G${row - 1}*(1+$G$24)` })
    row++
  }
  ws.getCell(`F${row}`).value = "Ganancia por valorización"
  ws.getCell(`F${row}`).font = { bold: true }
  money(`G${row}`, { formula: `G${row - 1}-G25` })
  ws.getCell(`G${row}`).fill = TOTAL_FILL
  ws.getCell(`H${row}`).value = { formula: `(G${row - 1}-G25)/G25` } as any
  ws.getCell(`H${row}`).numFmt = PCT
  // The ROI formula above points at G53 for the delivered value; make it real.
  ws.getCell("G53").value = { formula: `G${row - 1}` } as any
  ws.getCell("G53").numFmt = MONEY
  ws.getCell("F53").value = "Valor a la entrega (auxiliar del ROI)"
  ws.getCell("F53").font = { size: 9, color: { argb: "FF999999" } }

  // ─── Currency gain ────────────────────────────────────────────────────────
  if (a.copRateAtPurchase && a.copRateToday) {
    const base = row + 2
    section(`F${base}`, "PRECIO CON TASA DE CAMBIO (COP)")
    ws.getCell(`F${base + 1}`).value = "COP/USD al comprar"
    ws.getCell(`G${base + 1}`).value = a.copRateAtPurchase
    input_(`G${base + 1}`)
    ws.getCell(`H${base + 1}`).value = { formula: `D6*G${base + 1}` } as any
    ws.getCell(`H${base + 1}`).numFmt = "#,##0"
    ws.getCell(`F${base + 2}`).value = "COP/USD hoy"
    ws.getCell(`G${base + 2}`).value = a.copRateToday
    input_(`G${base + 2}`)
    ws.getCell(`H${base + 2}`).value = { formula: `D6*G${base + 2}` } as any
    ws.getCell(`H${base + 2}`).numFmt = "#,##0"
    ws.getCell(`F${base + 3}`).value = "Ganancia hoy (COP)"
    ws.getCell(`F${base + 3}`).font = { bold: true }
    ws.getCell(`G${base + 3}`).value = { formula: `H${base + 1}-H${base + 2}` } as any
    ws.getCell(`G${base + 3}`).numFmt = "#,##0"
    ws.getCell(`G${base + 3}`).fill = TOTAL_FILL
    ws.getCell(`H${base + 3}`).value = { formula: `G${base + 3}/H${base + 1}` } as any
    ws.getCell(`H${base + 3}`).numFmt = PCT
    ws.getCell(`I${base + 3}`).value = "No aparece en ningún indicador de retorno"
    ws.getCell(`I${base + 3}`).font = { size: 9, color: { argb: "FF666666" } }
  }

  // ─── Sheet 1 of the story: the headline Catherine reads out loud ──────────
  const money0 = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`
  const pct2 = (n: number) => `${n.toFixed(2)}%`
  const cop0 = (n: number) => Math.round(n).toLocaleString("en-US")

  // Substitute this project's real figures into the script, so Catherine never
  // reads a number that contradicts the sheet in front of the client.
  const TOKENS: Record<string, string> = {
    downPayment: money0(r.downPayment),
    cashFlowYear: money0(r.cashFlowYear),
    cashFlowMonth: money0(r.cashFlowMonth),
    cashOnCash: pct2(r.cashOnCashPct),
    roi: pct2(r.roiPct),
    capRate: pct2(r.capRatePct),
    copRateAtPurchase: a.copRateAtPurchase ? cop0(a.copRateAtPurchase) : "—",
    copRateToday: a.copRateToday ? cop0(a.copRateToday) : "—",
    copAtPurchase: r.cop ? cop0(r.cop.atPurchase) : "—",
    copToday: r.cop ? cop0(r.cop.today) : "—",
    copGain: r.cop ? cop0(r.cop.gain) : "—",
    copGainPct: r.cop ? `${r.cop.gainPct.toFixed(1)}%` : "—",
  }
  const fill = (text: string) => text.replace(/\{\{(\w+)\}\}/g, (m, k) => TOKENS[k] ?? m)

  sum.columns = [{ width: 34 }, { width: 20 }, { width: 16 }, { width: 62 }]

  const sTitle = sum.addRow([input.projectName])
  sTitle.getCell(1).font = { bold: true, size: 16 }
  if (input.unitLabel) sum.addRow([input.unitLabel]).getCell(1).font = { italic: true, color: { argb: "FF666666" } }
  sum.addRow([])

  const sHead = (text: string) => {
    const row = sum.addRow([text])
    row.getCell(1).font = { bold: true, size: 12 }
    row.getCell(1).fill = HEAD_FILL
    return row
  }
  const sLine = (k: string, v: string, note = "") => {
    const row = sum.addRow([k, v, "", note])
    row.getCell(2).font = { bold: true }
    row.getCell(4).font = { size: 9, color: { argb: "FF666666" } }
    return row
  }

  sHead("LO QUE COMPRA")
  sLine("Precio", money0(a.price))
  if (a.sqft) sLine("Superficie", `${a.sqft} sqft (${(a.sqft * 0.093).toFixed(1)} m2)`)
  else sLine("HOA", `$${r.hoa.toLocaleString()} al mes`, "Superficie no informada — se usó el HOA en dólares")
  sLine("Inicial que pone el cliente", money0(r.downPayment), `${(a.downPaymentPct * 100).toFixed(0)}% del precio`)
  sLine("Financia el banco", money0(r.financed), `${((1 - a.downPaymentPct) * 100).toFixed(0)}% al ${a.mortgageRatePct}%`)
  if (input.paymentSchedule) sLine("Plan de pagos", "", input.paymentSchedule)
  sum.addRow([])

  sHead("LO QUE PRODUCE AL MES")
  sLine("Renta estimada", money0(r.operatingIncome), `${money0(a.nightlyRate)} por noche al ${a.occupancyPct}% de ocupación = ${r.nightsPerMonth.toFixed(0)} noches`)
  sLine("Gastos de operación", `- ${money0(r.operatingExpenses)}`, "Administración, impuestos, HOA y seguro")
  sLine("Cuota del banco", `- ${money0(r.mortgage)}`)
  const flowRow = sLine("LE QUEDA EN EL BOLSILLO", money0(r.cashFlowMonth), `${money0(r.cashFlowYear)} al año`)
  flowRow.getCell(2).fill = TOTAL_FILL
  sum.addRow([])

  sHead("LOS 5 NÚMEROS — y qué significa cada uno")
  const head = sum.addRow(["Indicador", "Resultado", "Calificación", "Cómo explicárselo al cliente"])
  head.font = { bold: true }
  const byKey = Object.fromEntries(EXPLAINERS.map(e => [e.key, e]))
  const fiveRows: Array<[string, string, string, string]> = [
    ["1. NOI (sin la deuda)", `${money0(r.noiMonth)}/mes`, r.noiMonth > 0 ? "Positivo" : "Negativo", fill(byKey.noi.comoExplicarlo)],
    ["2. Cash Flow (con la deuda)", `${money0(r.cashFlowMonth)}/mes`, r.cashFlowMonth > 0 ? "Positivo" : "Negativo", fill(byKey.cashflow.comoExplicarlo)],
    ["3. Cash on Cash", pct2(r.cashOnCashPct), r.cashOnCashBand, fill(byKey.cashoncash.comoExplicarlo)],
    ["4. ROI", pct2(r.roiPct), r.roiBand, fill(byKey.roi.comoExplicarlo)],
    ["5. Cap Rate", pct2(r.capRatePct), r.capRateBand, fill(byKey.caprate.comoExplicarlo)],
  ]
  fiveRows.forEach(cells => {
    const row = sum.addRow(cells)
    row.getCell(2).font = { bold: true }
    row.getCell(3).font = { bold: true }
    if (cells[2] === "Muy Bueno" || cells[2] === "Bueno") row.getCell(3).font = { bold: true, color: { argb: "FF1E7B34" } }
    if (cells[2] === "Bajo") row.getCell(3).font = { bold: true, color: { argb: "FFB00020" } }
    row.getCell(4).alignment = { wrapText: true, vertical: "top" }
    row.height = 46
  })
  sum.addRow([])

  sHead("LO QUE GANA SIN HACER NADA")
  sLine("Valorización a la entrega", money0(r.appreciation),
    `El precio de lista pasa de ${money0(a.price)} a ${money0(r.appreciatedValue)} (${a.appreciationPerPeriodPct}% por lista, ${a.appreciationPeriods} listas)`)
  sLine("Abono a capital en el año 1", money0(r.principalYear), "Deja de deberle esto al banco — es patrimonio, no gasto")
  sLine("Gastos de cierre", `- ${money0(r.closingCosts)}`, `${a.closingCostPct}% del precio`)
  if (r.cop) {
    sum.addRow([])
    sHead("VENTAJA POR TASA DE CAMBIO (para el comprador colombiano)")
    sLine(`Costaba con el dólar a ${a.copRateAtPurchase!.toLocaleString()}`, `${Math.round(r.cop.atPurchase).toLocaleString()} COP`)
    sLine(`Cuesta con el dólar a ${a.copRateToday!.toLocaleString()}`, `${Math.round(r.cop.today).toLocaleString()} COP`)
    const copRow = sLine("DIFERENCIA A FAVOR", `${Math.round(r.cop.gain).toLocaleString()} COP`, `${r.cop.gainPct.toFixed(1)}% menos por el mismo apartamento`)
    copRow.getCell(2).fill = TOTAL_FILL
  }

  // ─── Sheet: the script, one indicator per block ───────────────────────────
  guide.columns = [{ width: 24 }, { width: 108 }]
  const gTitle = guide.addRow(["Guion para explicarle los números a cualquier cliente"])
  gTitle.getCell(1).font = { bold: true, size: 14 }
  guide.addRow(["Léalo de arriba abajo. Cada bloque es un número del resumen."]).getCell(1).font = { italic: true, color: { argb: "FF666666" } }
  guide.addRow([])

  EXPLAINERS.filter(e => e.key !== "cambio" || r.cop).forEach(e => {
    const t = guide.addRow([e.title])
    t.getCell(1).font = { bold: true, size: 12 }
    t.getCell(1).fill = HEAD_FILL
    guide.mergeCells(`A${t.number}:B${t.number}`)
    const block: Array<[string, string | undefined]> = [
      ["Qué es", fill(e.queEs)],
      ["Cómo explicarlo", fill(e.comoExplicarlo)],
      ["Por qué importa", fill(e.porQueImporta)],
      ["Si el número es bajo", e.siEsBajo ? fill(e.siEsBajo) : undefined],
      ["Rangos", e.rangos],
    ]
    block.forEach(([k, v]) => {
      if (!v) return
      const row = guide.addRow([k, v])
      row.getCell(1).font = { bold: true, size: 10 }
      row.getCell(1).alignment = { vertical: "top" }
      row.getCell(2).alignment = { wrapText: true, vertical: "top" }
      row.height = Math.max(16, Math.ceil(v.length / 95) * 15)
    })
    guide.addRow([])
  })

  // ─── Year by year, and what a sale actually nets ──────────────────────────
  const pin: ProjectionInputs = { ...PROJECTION_DEFAULTS, ...(input.projection || {}) }
  const years = project(a, pin)
  const assign = assignmentScenario(a)

  proj.columns = [
    { width: 7 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 16 },
    { width: 16 }, { width: 16 }, { width: 18 }, { width: 14 },
  ]
  const pTitle = proj.addRow([`${input.projectName} — proyección a ${pin.years} años`])
  pTitle.getCell(1).font = { bold: true, size: 14 }
  proj.addRow([`Valorización de reventa ${pin.marketAppreciationPct}% al año · renta +${pin.rentGrowthPct}% · gastos +${pin.expenseGrowthPct}% · costos de venta ${pin.sellingCostPct}%`])
    .getCell(1).font = { italic: true, color: { argb: "FF666666" } }
  proj.addRow([`Inversión inicial del cliente: ${money0(r.downPayment + r.closingCosts)} (inicial ${money0(r.downPayment)} + gastos de cierre ${money0(r.closingCosts)})`])
    .getCell(1).font = { bold: true }
  proj.addRow([])

  const ph = proj.addRow(["Año", "Valor propiedad", "Renta anual", "Flujo del año", "Flujo acumulado", "Saldo hipoteca", "Patrimonio", "Si vende, le queda", "Anualizado"])
  ph.font = { bold: true }
  ph.eachCell(c => { c.fill = HEAD_FILL })

  years.forEach(y => {
    const row = proj.addRow([
      y.year, y.propertyValue, y.grossRent, y.cashFlow, y.cumulativeCashFlow,
      y.loanBalance, y.equity, y.totalProfitIfSold, y.annualizedReturnPct / 100,
    ])
    for (let c = 2; c <= 8; c++) row.getCell(c).numFmt = MONEY
    row.getCell(9).numFmt = PCT
    row.getCell(8).font = { bold: true }
    if (y.totalProfitIfSold > 0) row.getCell(8).font = { bold: true, color: { argb: "FF1E7B34" } }
    else row.getCell(8).font = { bold: true, color: { argb: "FFB00020" } }
  })

  proj.addRow([])
  const note = proj.addRow(["", '"Si vende, le queda" ya descuenta los costos de venta y el saldo de la hipoteca, y suma todo el flujo cobrado hasta ese año, menos lo que el cliente puso al inicio. Es la ganancia neta real de la operación completa.'])
  note.getCell(2).font = { size: 9, color: { argb: "FF666666" } }
  note.getCell(2).alignment = { wrapText: true }
  note.height = 32

  proj.addRow([])
  const aTitle = proj.addRow(["VENDER EL CONTRATO ANTES DE CERRAR (cesión)"])
  aTitle.getCell(1).font = { bold: true, size: 12 }
  aTitle.getCell(1).fill = HEAD_FILL
  const aRow = (k: string, v: string, n = "") => {
    const row = proj.addRow([k, v, "", n])
    row.getCell(2).font = { bold: true }
    row.getCell(4).font = { size: 9, color: { argb: "FF666666" } }
  }
  aRow("Depósitos pagados", money0(assign.depositsPaid), "Lo único que el cliente arriesga")
  aRow("Precio de contrato", money0(assign.contractPrice))
  aRow("Valor a la entrega", money0(assign.valueAtDelivery))
  aRow("Ganancia bruta", money0(assign.grossGain))
  aRow("Fee de cesión estimado", `- ${money0(assign.assignmentFee)}`)
  aRow("GANANCIA NETA", money0(assign.netGain))
  aRow("Retorno sobre los depósitos", `${assign.returnOnDepositsPct.toFixed(1)}%`, "Sin haber cerrado ni pedido hipoteca")
  const warn2 = proj.addRow(["", assign.caveat])
  warn2.getCell(2).font = { bold: true, color: { argb: "FFB00020" } }
  warn2.getCell(2).alignment = { wrapText: true }
  warn2.height = 32

  // ─── Payment schedule, notes, sources ─────────────────────────────────────
  tail.columns = [{ width: 28 }, { width: 110 }]
  const put = (k: string, v: string) => tail.addRow([k, v]).getCell(1).font = { bold: true }

  put("Proyecto", input.projectName)
  if (input.unitLabel) put("Unidad", input.unitLabel)
  if (input.paymentSchedule) put("Estructura de pagos", input.paymentSchedule)
  tail.addRow([])
  put("Precio", `$${a.price.toLocaleString()}`)
  put("Superficie", a.sqft ? `${a.sqft} sqft` : "no informada")
  put("Renta por noche", `$${a.nightlyRate}`)
  put("Ocupación", `${a.occupancyPct}%`)
  put("Property management", `${(a.propertyMgmtPct * 100).toFixed(0)}%`)
  put("Impuestos", `${a.taxRatePct}% anual`)
  put("HOA", a.hoaMonthly ? `$${a.hoaMonthly} al mes (monto directo)` : `$${a.hoaPerSqft}/sqft al mes`)
  put("Seguro", `$${a.insuranceMonthly} al mes`)
  put("Hipoteca", `${a.mortgageRatePct}% a ${a.mortgageYears} años sobre el ${((1 - a.downPaymentPct) * 100).toFixed(0)}% financiado`)
  put("Gastos de cierre", `${a.closingCostPct}% del precio`)
  put("Valorización", `${a.appreciationPerPeriodPct}% por lista, ${a.appreciationPeriods} listas hasta la entrega`)
  tail.addRow([])

  if (input.notes?.length) {
    put("Notas", "")
    input.notes.forEach(n => tail.addRow(["", n]))
    tail.addRow([])
  }
  if (input.sources?.length) {
    put("Fuentes", "")
    input.sources.forEach(s => tail.addRow(["", s]))
    tail.addRow([])
  }
  tail.addRow([])
  const warn = tail.addRow(["", "Las celdas amarillas son los supuestos: cámbialos y todos los indicadores se recalculan. Los números son estimados y varían según el banco, el operador y la ocupación real."])
  warn.getCell(2).font = { italic: true, color: { argb: "FF999999" } }

  const out = await wb.xlsx.writeBuffer()
  return Buffer.from(out)
}
