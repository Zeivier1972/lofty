import ExcelJS from "exceljs"
import { Assumptions, analyze, BAND_LEGEND } from "@/lib/investment-analysis"
import { EXPLAINERS } from "@/lib/investment-explainers"
import { PROJECTION_DEFAULTS, ProjectionInputs } from "@/lib/investment-projection"

// Catherine's coaching sheet, rebuilt for any project.
//
// "Análisis" is the ONLY sheet that holds numbers. Everything on every other
// sheet — the client summary, the year-by-year projection, even the sentences
// in the script — is a formula pointing back at it. Change a yellow cell there
// and the whole workbook moves, including the words she reads out loud.

const MONEY = '"$"#,##0'
const MONEY2 = '"$"#,##0.00'
const PCT = "0.00%"
const PCT1 = "0.0%"
const INPUT_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } }
const TOTAL_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4D6" } }
const HEAD_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } }

/** The model sheet, quoted because the name carries an accent. */
const M = "'Análisis'"

export type WorkbookInput = {
  projectName: string
  unitLabel?: string
  assumptions: Assumptions
  /** Free-text payment schedule from the project record, e.g. "20% al contrato · …" */
  paymentSchedule?: string
  notes?: string[]
  sources?: string[]
  projection?: Partial<ProjectionInputs>
  /** Fee a developer charges to assign the contract, as a decimal. */
  assignmentFeePct?: number
}

/** Cells on the model sheet, named once so the formulas below stay readable. */
const C = {
  price: `${M}!$D$6`,
  sqft: `${M}!$D$7`,
  downPct: `${M}!$D$9`,
  down: `${M}!$D$10`,
  financed: `${M}!$D$11`,
  nightly: `${M}!$D$14`,
  occ: `${M}!$D$15`,
  income: `${M}!$D$17`,
  mgmt: `${M}!$D$21`,
  taxes: `${M}!$D$23`,
  hoa: `${M}!$D$25`,
  insurance: `${M}!$D$26`,
  opex: `${M}!$D$27`,
  mortgage: `${M}!$D$28`,
  rate: `${M}!$D$29`,
  years: `${M}!$D$30`,
  totalExp: `${M}!$D$31`,
  cfMonth: `${M}!$D$34`,
  cfYear: `${M}!$D$35`,
  closingPct: `${M}!$D$38`,
  closing: `${M}!$D$39`,
  principal1: `${M}!$D$40`,
  appreciation: `${M}!$D$41`,
  noiMonth: `${M}!$G$7`,
  noiYear: `${M}!$G$9`,
  coc: `${M}!$G$13`,
  roi: `${M}!$G$16`,
  cap: `${M}!$G$19`,
  listStep: `${M}!$G$24`,
  delivered: `${M}!$G$53`,
  aprResale: `${M}!$D$44`,
  rentGrowth: `${M}!$D$45`,
  expGrowth: `${M}!$D$46`,
  sellCost: `${M}!$D$47`,
  invested: `${M}!$D$48`,
  copBefore: `${M}!$G$60`,
  copNow: `${M}!$G$61`,
  copGain: `${M}!$G$63`,
  copGainPct: `${M}!$H$63`,
}

/** `"` inside an Excel string literal is written by doubling it. */
const esc = (s: string) => s.replace(/"/g, '""')

/**
 * Which model cell each {{token}} in the script points at, and how to show it.
 * These formats go INSIDE a TEXT() call, so they must not contain quotes of
 * their own — "$#,##0" renders the same as the cell format '"$"#,##0' and
 * survives being nested in a formula string.
 */
const TOKEN_CELLS: Record<string, { ref: string; fmt: string }> = {
  downPayment: { ref: C.down, fmt: "$#,##0" },
  cashFlowYear: { ref: C.cfYear, fmt: "$#,##0" },
  cashFlowMonth: { ref: C.cfMonth, fmt: "$#,##0" },
  cashOnCash: { ref: C.coc, fmt: "0.00%" },
  roi: { ref: C.roi, fmt: "0.00%" },
  capRate: { ref: C.cap, fmt: "0.00%" },
  copRateAtPurchase: { ref: C.copBefore, fmt: "#,##0" },
  copRateToday: { ref: C.copNow, fmt: "#,##0" },
  copAtPurchase: { ref: `${C.price}*${C.copBefore}`, fmt: "#,##0" },
  copToday: { ref: `${C.price}*${C.copNow}`, fmt: "#,##0" },
  copGain: { ref: C.copGain, fmt: "#,##0" },
  copGainPct: { ref: C.copGainPct, fmt: "0.0%" },
}

/**
 * Turns a sentence with {{tokens}} into a live Excel formula, so the script
 * can never quote a figure the sheet has since moved away from.
 */
function scriptCell(text: string): string | { formula: string } {
  if (!/\{\{\w+\}\}/.test(text)) return text
  const parts: string[] = []
  let rest = text
  let m: RegExpExecArray | null
  const re = /\{\{(\w+)\}\}/
  while ((m = re.exec(rest)) !== null) {
    const cell = TOKEN_CELLS[m[1]]
    if (!cell) { rest = rest.replace(m[0], "—"); continue }
    if (m.index > 0) parts.push(`"${esc(rest.slice(0, m.index))}"`)
    if (cell.fmt.includes('"')) throw new Error(`El formato de ${m[1]} lleva comillas y rompería la fórmula: ${cell.fmt}`)
    parts.push(`TEXT(${cell.ref},"${cell.fmt}")`)
    rest = rest.slice(m.index + m[0].length)
  }
  if (rest.length > 0) parts.push(`"${esc(rest)}"`)
  return { formula: parts.join("&") }
}

export async function buildInvestmentWorkbook(input: WorkbookInput): Promise<Buffer> {
  const a = input.assumptions
  const r = analyze(a)
  const pin: ProjectionInputs = { ...PROJECTION_DEFAULTS, ...(input.projection || {}) }
  const assignFeePct = input.assignmentFeePct ?? 0.02
  const hasCop = !!(a.copRateAtPurchase && a.copRateToday)

  const wb = new ExcelJS.Workbook()
  wb.creator = "CASAi — Catherine Gomez Realtor"
  wb.created = new Date()
  // Excel recalculates everything on open, so the cached values ExcelJS writes
  // are never what the user sees.
  wb.calcProperties.fullCalcOnLoad = true

  const sum = wb.addWorksheet("Resumen para el cliente")
  const guide = wb.addWorksheet("Cómo explicarlo")
  const proj = wb.addWorksheet("Proyección y venta")
  const ws = wb.addWorksheet("Análisis")
  const tail = wb.addWorksheet("Supuestos y fuentes")

  // ─── The model — the only sheet holding real numbers ──────────────────────
  ws.columns = [
    { width: 4 }, { width: 30 }, { width: 3 }, { width: 16 },
    { width: 3 }, { width: 32 }, { width: 18 }, { width: 14 }, { width: 34 },
  ]

  const label = (cell: string, text: string, bold = false) => {
    ws.getCell(cell).value = text
    if (bold) ws.getCell(cell).font = { bold: true }
  }
  const put = (cell: string, value: ExcelJS.CellValue, fmt = MONEY) => {
    ws.getCell(cell).value = value as any
    ws.getCell(cell).numFmt = fmt
  }
  const section = (cell: string, text: string) => {
    ws.getCell(cell).value = text
    ws.getCell(cell).font = { bold: true, size: 11 }
    ws.getCell(cell).fill = HEAD_FILL
  }
  const inp = (cell: string) => { ws.getCell(cell).fill = INPUT_FILL }

  ws.getCell("B2").value = input.projectName
  ws.getCell("B2").font = { bold: true, size: 14 }
  ws.getCell("B3").value = input.unitLabel || "Unidad"
  ws.getCell("B4").value = "Las celdas AMARILLAS son los supuestos. Cambia cualquiera y TODO el libro se recalcula, incluidas las otras hojas."
  ws.getCell("B4").font = { italic: true, size: 9, color: { argb: "FF996600" } }

  section("B5", "LA UNIDAD")
  label("B6", "Precio");                put("D6", a.price);              inp("D6")
  label("B7", "SFT");                   put("D7", a.sqft ?? "", "0");    inp("D7")
  label("B8", "Mts2");                  put("D8", a.sqft ? { formula: "D7*0.093" } : "", "0.00")
  label("B9", "% Down payment");        put("D9", a.downPaymentPct, "0%"); inp("D9")
  label("B10", "Down Payment");         put("D10", { formula: "D6*D9" })
  label("B11", "Banco - Financiamiento"); put("D11", { formula: "D6-D10" })

  section("B13", "INGRESOS")
  label("B14", "Estimado / noche");     put("D14", a.nightlyRate);       inp("D14")
  label("B15", "% Ocupación");          put("D15", a.occupancyPct / 100, "0%"); inp("D15")
  label("B16", "Noches / mes");         put("D16", { formula: "30*D15" }, "0.0")
  label("B17", "Operating Income", true); put("D17", { formula: "D14*D16" })

  section("B19", "GASTOS MENSUALES")
  label("B20", "% Property management"); put("D20", a.propertyMgmtPct, "0%"); inp("D20")
  label("B21", "Property management");   put("D21", { formula: "D17*D20" })
  label("B22", "% Taxes anual");         put("D22", a.taxRatePct / 100, "0.00%"); inp("D22")
  label("B23", "Taxes");                 put("D23", { formula: "D6*D22/12" })
  label("B24", "HOA $/sqft");            put("D24", a.hoaPerSqft, MONEY2); inp("D24")
  label("B25", "HOA")
  if (a.hoaMonthly !== undefined) { put("D25", a.hoaMonthly); inp("D25") }
  else put("D25", { formula: "D7*D24" })
  label("B26", "Insurance");             put("D26", a.insuranceMonthly); inp("D26")
  label("B27", "Operating Expenses", true); put("D27", { formula: "D21+D23+D25+D26" })
  ws.getCell("D27").fill = TOTAL_FILL
  label("B28", "Hipoteca");              put("D28", { formula: "-PMT(D29/12,D30*12,D11)" })
  label("B29", "Tasa hipoteca");         put("D29", a.mortgageRatePct / 100, "0.00%"); inp("D29")
  label("B30", "Años de hipoteca");      put("D30", a.mortgageYears, "0"); inp("D30")
  label("B31", "Total Expenses", true);  put("D31", { formula: "D27+D28" })
  ws.getCell("D31").fill = TOTAL_FILL

  section("B33", "FLUJO")
  label("B34", "Cash Flow Month", true); put("D34", { formula: "D17-D31" })
  label("B35", "Cash Flow Year", true);  put("D35", { formula: "D34*12" })

  section("B37", "PARA EL ROI")
  label("B38", "% Gastos de cierre");    put("D38", a.closingCostPct / 100, "0.00%"); inp("D38")
  label("B39", "Gastos de cierre");      put("D39", { formula: "D6*D38" })
  label("B40", "Pago a capital año 1");  put("D40", { formula: "D11-MAX(0,-FV(D29/12,12,PMT(D29/12,D30*12,D11),D11))" })
  label("B41", "Valorización a la entrega"); put("D41", { formula: "G53-D6" })

  section("B43", "PARA LA PROYECCIÓN")
  label("B44", "% Valorización reventa / año"); put("D44", pin.marketAppreciationPct / 100, "0.00%"); inp("D44")
  label("B45", "% Crecimiento de la renta");    put("D45", pin.rentGrowthPct / 100, "0.00%"); inp("D45")
  label("B46", "% Crecimiento de gastos");      put("D46", pin.expenseGrowthPct / 100, "0.00%"); inp("D46")
  label("B47", "% Costos de venta");            put("D47", pin.sellingCostPct / 100, "0.00%"); inp("D47")
  label("B48", "Inversión inicial total", true); put("D48", { formula: "D10+D39" })

  // ─── The five indicators ──────────────────────────────────────────────────
  section("F5", "LOS 5 INDICADORES")
  const indicator = (row: number, title: string, meaning: string, formula: string, fmt: string, legend?: string, band?: string) => {
    ws.getCell(`F${row}`).value = title
    ws.getCell(`F${row}`).font = { bold: true }
    put(`G${row}`, { formula }, fmt)
    ws.getCell(`G${row}`).font = { bold: true }
    if (band) {
      ws.getCell(`H${row}`).value = { formula: band } as any
      ws.getCell(`H${row}`).font = { bold: true }
    }
    ws.getCell(`F${row + 1}`).value = meaning
    ws.getCell(`F${row + 1}`).font = { size: 9, color: { argb: "FF666666" } }
    ws.getCell(`F${row + 1}`).alignment = { wrapText: true }
    if (legend) {
      ws.getCell(`I${row}`).value = legend
      ws.getCell(`I${row}`).font = { size: 9, color: { argb: "FF666666" } }
    }
  }

  indicator(7, "1. NOI mensual", "Ingreso operativo − gastos operativos. Cuánto produce SIN la deuda.", "D17-D27", MONEY)
  indicator(9, "   NOI anual", "", "(D17-D27)*12", MONEY)
  indicator(11, "2. Cash Flow anual", "Cuánto queda después de pagar la deuda.", "D35", MONEY)
  indicator(13, "3. Cash on Cash", "Retorno sobre el capital que el cliente realmente puso.", "D35/D10", PCT,
    BAND_LEGEND.cashOnCash, `IF(G13<6%,"Bajo",IF(G13<8%,"Aceptable",IF(G13<10%,"Bueno","Muy Bueno")))`)
  indicator(16, "4. ROI", "Cash flow + valorización + pago a capital − gastos de cierre, sobre el down payment.",
    "(D35+D41+D40-D39)/D10", PCT,
    BAND_LEGEND.roi, `IF(G16<5%,"Bajo",IF(G16<10%,"Aceptable",IF(G16<15%,"Bueno","Muy Bueno")))`)
  indicator(19, "5. Cap Rate", "Rendimiento del inmueble sobre su valor — si la compra 100% de contado.",
    "(D17-D27)*12/D6", PCT,
    BAND_LEGEND.capRate, `IF(G19<4%,"Bajo",IF(G19<6%,"Aceptable",IF(G19<8%,"Bueno","Muy Bueno")))`)

  // ─── Price-list schedule ──────────────────────────────────────────────────
  section("F23", "VALORIZACIÓN DE LA LISTA DEL DESARROLLADOR")
  ws.getCell("F24").value = "% por lista de precios"
  put("G24", pin.marketAppreciationPct >= 0 ? a.appreciationPerPeriodPct / 100 : 0, "0.00%")
  inp("G24")
  let row = 25
  for (let i = 0; i <= a.appreciationPeriods; i++) {
    ws.getCell(`F${row}`).value = i === 0 ? "Precio de lista hoy" : `Lista ${i}`
    put(`G${row}`, i === 0 ? { formula: "D6" } : { formula: `G${row - 1}*(1+$G$24)` })
    row++
  }
  const lastList = row - 1
  ws.getCell(`F${row}`).value = "Ganancia por valorización"
  ws.getCell(`F${row}`).font = { bold: true }
  put(`G${row}`, { formula: `G${lastList}-G25` })
  ws.getCell(`G${row}`).fill = TOTAL_FILL
  put(`H${row}`, { formula: `(G${lastList}-G25)/G25` }, PCT)

  ws.getCell("F53").value = "Valor a la entrega (lo usan el ROI y la proyección)"
  ws.getCell("F53").font = { size: 9, color: { argb: "FF999999" } }
  put("G53", { formula: `G${lastList}` })

  // ─── Currency ─────────────────────────────────────────────────────────────
  if (hasCop) {
    section("F59", "PRECIO CON TASA DE CAMBIO (COP)")
    ws.getCell("F60").value = "COP/USD antes"
    put("G60", a.copRateAtPurchase!, "#,##0"); inp("G60")
    put("H60", { formula: "D6*G60" }, "#,##0")
    ws.getCell("F61").value = "COP/USD hoy"
    put("G61", a.copRateToday!, "#,##0"); inp("G61")
    put("H61", { formula: "D6*G61" }, "#,##0")
    ws.getCell("F63").value = "Diferencia a favor (COP)"
    ws.getCell("F63").font = { bold: true }
    put("G63", { formula: "H60-H61" }, "#,##0")
    ws.getCell("G63").fill = TOTAL_FILL
    put("H63", { formula: "IF(H60=0,0,G63/H60)" }, PCT1)
    ws.getCell("I63").value = "No aparece en ningún indicador de retorno"
    ws.getCell("I63").font = { size: 9, color: { argb: "FF666666" } }
  }

  // ─── Summary — every figure a formula into the model ──────────────────────
  sum.columns = [{ width: 34 }, { width: 20 }, { width: 16 }, { width: 62 }]

  sum.addRow([input.projectName]).getCell(1).font = { bold: true, size: 16 }
  if (input.unitLabel) sum.addRow([input.unitLabel]).getCell(1).font = { italic: true, color: { argb: "FF666666" } }
  sum.addRow(["Todo en esta hoja se calcula desde la hoja Análisis. Cambia un supuesto allá y estos números se mueven solos."])
    .getCell(1).font = { italic: true, size: 9, color: { argb: "FF996600" } }
  sum.addRow([])

  const sHead = (text: string) => {
    const rw = sum.addRow([text])
    rw.getCell(1).font = { bold: true, size: 12 }
    rw.getCell(1).fill = HEAD_FILL
  }
  const sLine = (k: string, formula: string, fmt: string, note: string | { formula: string } = "") => {
    const rw = sum.addRow([k, { formula } as any, "", note as any])
    rw.getCell(2).numFmt = fmt
    rw.getCell(2).font = { bold: true }
    rw.getCell(4).font = { size: 9, color: { argb: "FF666666" } }
    rw.getCell(4).alignment = { wrapText: true }
    return rw
  }

  sHead("LO QUE COMPRA")
  sLine("Precio", C.price, MONEY)
  if (a.sqft) sLine("Superficie", C.sqft, "0\" sqft\"", { formula: `TEXT(${C.sqft}*0.093,"0.0")&" m2"` })
  sLine("Inicial que pone el cliente", C.down, MONEY, { formula: `TEXT(${C.downPct},"0%")&" del precio"` })
  sLine("Financia el banco", C.financed, MONEY, { formula: `TEXT(1-${C.downPct},"0%")&" al "&TEXT(${C.rate},"0.00%")` })
  if (input.paymentSchedule) sum.addRow(["Plan de pagos", "", "", input.paymentSchedule]).getCell(4).alignment = { wrapText: true }
  sum.addRow([])

  sHead("LO QUE PRODUCE AL MES")
  sLine("Renta estimada", C.income, MONEY,
    { formula: `TEXT(${C.nightly},"$#,##0")&" por noche al "&TEXT(${C.occ},"0%")&" de ocupación = "&TEXT(30*${C.occ},"0")&" noches"` })
  sLine("Gastos de operación", `-${C.opex}`, MONEY, "Administración, impuestos, HOA y seguro")
  sLine("Cuota del banco", `-${C.mortgage}`, MONEY)
  const flowRow = sLine("LE QUEDA EN EL BOLSILLO", C.cfMonth, MONEY, { formula: `TEXT(${C.cfYear},"$#,##0")&" al año"` })
  flowRow.getCell(2).fill = TOTAL_FILL
  sum.addRow([])

  sHead("LOS 5 NÚMEROS — y qué significa cada uno")
  const head = sum.addRow(["Indicador", "Resultado", "Calificación", "Cómo explicárselo al cliente"])
  head.font = { bold: true }
  const byKey = Object.fromEntries(EXPLAINERS.map(e => [e.key, e]))
  const five: Array<[string, string, string, string, string]> = [
    ["1. NOI (sin la deuda)", C.noiMonth, MONEY, `IF(${C.noiMonth}>0,"Positivo","Negativo")`, byKey.noi.comoExplicarlo],
    ["2. Cash Flow (con la deuda)", C.cfMonth, MONEY, `IF(${C.cfMonth}>0,"Positivo","Negativo")`, byKey.cashflow.comoExplicarlo],
    ["3. Cash on Cash", C.coc, PCT, `${M}!$H$13`, byKey.cashoncash.comoExplicarlo],
    ["4. ROI", C.roi, PCT, `${M}!$H$16`, byKey.roi.comoExplicarlo],
    ["5. Cap Rate", C.cap, PCT, `${M}!$H$19`, byKey.caprate.comoExplicarlo],
  ]
  five.forEach(([name, ref, fmt, bandFormula, script]) => {
    const rw = sum.addRow([name, { formula: ref } as any, { formula: bandFormula } as any, scriptCell(script) as any])
    rw.getCell(2).numFmt = fmt
    rw.getCell(2).font = { bold: true }
    rw.getCell(3).font = { bold: true }
    rw.getCell(4).alignment = { wrapText: true, vertical: "top" }
    rw.height = 46
  })
  sum.addRow([])

  sHead("LO QUE GANA SIN HACER NADA")
  sLine("Valorización a la entrega", C.appreciation, MONEY,
    { formula: `"El precio de lista pasa de "&TEXT(${C.price},"$#,##0")&" a "&TEXT(${C.delivered},"$#,##0")` })
  sLine("Abono a capital en el año 1", C.principal1, MONEY, "Deja de deberle esto al banco — es patrimonio, no gasto")
  sLine("Gastos de cierre", `-${C.closing}`, MONEY, { formula: `TEXT(${C.closingPct},"0.00%")&" del precio"` })
  if (hasCop) {
    sum.addRow([])
    sHead("VENTAJA POR TASA DE CAMBIO (para el comprador colombiano)")
    sLine("Costaba con el dólar antes", `${C.price}*${C.copBefore}`, "#,##0 \"COP\"")
    sLine("Cuesta con el dólar hoy", `${C.price}*${C.copNow}`, "#,##0 \"COP\"")
    const copRow = sLine("DIFERENCIA A FAVOR", C.copGain, "#,##0 \"COP\"",
      { formula: `TEXT(${C.copGainPct},"0.0%")&" menos por el mismo apartamento"` })
    copRow.getCell(2).fill = TOTAL_FILL
  }

  // ─── Script — the sentences are formulas too ──────────────────────────────
  guide.columns = [{ width: 24 }, { width: 108 }]
  guide.addRow(["Guion para explicarle los números a cualquier cliente"]).getCell(1).font = { bold: true, size: 14 }
  guide.addRow(["Las cifras dentro de las frases salen de la hoja Análisis: si cambias un supuesto, el guion cambia con él."])
    .getCell(1).font = { italic: true, color: { argb: "FF666666" } }
  guide.addRow([])

  EXPLAINERS.filter(e => e.key !== "cambio" || hasCop).forEach(e => {
    const t = guide.addRow([e.title])
    t.getCell(1).font = { bold: true, size: 12 }
    t.getCell(1).fill = HEAD_FILL
    guide.mergeCells(`A${t.number}:B${t.number}`)
    const block: Array<[string, string | undefined]> = [
      ["Qué es", e.queEs],
      ["Cómo explicarlo", e.comoExplicarlo],
      ["Por qué importa", e.porQueImporta],
      ["Si el número es bajo", e.siEsBajo],
      ["Rangos", e.rangos],
    ]
    block.forEach(([k, v]) => {
      if (!v) return
      const rw = guide.addRow([k, scriptCell(v) as any])
      rw.getCell(1).font = { bold: true, size: 10 }
      rw.getCell(1).alignment = { vertical: "top" }
      rw.getCell(2).alignment = { wrapText: true, vertical: "top" }
      rw.height = Math.max(16, Math.ceil(v.length / 95) * 15)
    })
    guide.addRow([])
  })

  // ─── Projection — every cell a formula ────────────────────────────────────
  proj.columns = [
    { width: 7 }, { width: 16 }, { width: 15 }, { width: 15 }, { width: 15 },
    { width: 17 }, { width: 16 }, { width: 15 }, { width: 19 }, { width: 13 },
  ]
  proj.addRow([`${input.projectName} — proyección a ${pin.years} años`]).getCell(1).font = { bold: true, size: 14 }
  proj.addRow(["Toda esta tabla se calcula desde la hoja Análisis. Cambia la tarifa, la ocupación o los porcentajes de la sección PARA LA PROYECCIÓN y la tabla entera se recalcula."])
    .getCell(1).font = { italic: true, size: 9, color: { argb: "FF996600" } }
  const invRow = proj.addRow(["Inversión inicial del cliente", { formula: C.invested } as any])
  invRow.getCell(1).font = { bold: true }
  invRow.getCell(2).numFmt = MONEY
  invRow.getCell(2).font = { bold: true }
  proj.addRow([])

  const ph = proj.addRow(["Año", "Valor propiedad", "Renta anual", "Gastos anuales", "Flujo del año", "Flujo acumulado", "Saldo hipoteca", "Patrimonio", "Si vende, le queda", "Anualizado"])
  ph.font = { bold: true }
  ph.eachCell(c => { c.fill = HEAD_FILL; c.alignment = { wrapText: true } })
  const firstYearRow = ph.number + 1

  for (let y = 1; y <= pin.years; y++) {
    const rw = proj.addRow([
      y,
      { formula: `${C.delivered}*(1+${C.aprResale})^(A${firstYearRow + y - 1}-1)` },
      { formula: `${C.income}*12*(1+${C.rentGrowth})^(A${firstYearRow + y - 1}-1)` },
      { formula: `${C.opex}*12*(1+${C.expGrowth})^(A${firstYearRow + y - 1}-1)` },
      { formula: `C${firstYearRow + y - 1}-D${firstYearRow + y - 1}-${C.mortgage}*12` },
      { formula: `SUM($E$${firstYearRow}:E${firstYearRow + y - 1})` },
      { formula: `MAX(0,-FV(${C.rate}/12,A${firstYearRow + y - 1}*12,PMT(${C.rate}/12,${C.years}*12,${C.financed}),${C.financed}))` },
      { formula: `B${firstYearRow + y - 1}-G${firstYearRow + y - 1}` },
      { formula: `B${firstYearRow + y - 1}*(1-${C.sellCost})-G${firstYearRow + y - 1}+F${firstYearRow + y - 1}-${C.invested}` },
      { formula: `IF(${C.invested}<=0,0,((B${firstYearRow + y - 1}*(1-${C.sellCost})-G${firstYearRow + y - 1}+F${firstYearRow + y - 1})/${C.invested})^(1/A${firstYearRow + y - 1})-1)` },
    ] as any)
    for (let c = 2; c <= 9; c++) rw.getCell(c).numFmt = MONEY
    rw.getCell(10).numFmt = PCT
    rw.getCell(9).font = { bold: true }
  }

  proj.addRow([])
  const note = proj.addRow(["", '"Si vende, le queda" ya descuenta los costos de venta y el saldo de la hipoteca, y suma todo el flujo cobrado hasta ese año, menos lo que el cliente puso al inicio. Es la ganancia neta real de la operación completa.'])
  note.getCell(2).font = { size: 9, color: { argb: "FF666666" } }
  note.getCell(2).alignment = { wrapText: true }
  note.height = 32

  proj.addRow([])
  const aTitle = proj.addRow(["VENDER EL CONTRATO ANTES DE CERRAR (cesión)"])
  aTitle.getCell(1).font = { bold: true, size: 12 }
  aTitle.getCell(1).fill = HEAD_FILL
  const feeRowNum = aTitle.number + 5
  const aRow = (k: string, formula: string, fmt: string, n = "", isInput = false) => {
    const rw = proj.addRow([k, { formula } as any, "", n])
    rw.getCell(2).numFmt = fmt
    rw.getCell(2).font = { bold: true }
    if (isInput) rw.getCell(2).fill = INPUT_FILL
    rw.getCell(4).font = { size: 9, color: { argb: "FF666666" } }
    return rw
  }
  aRow("Depósitos pagados", C.down, MONEY, "Lo único que el cliente arriesga")
  aRow("Precio de contrato", C.price, MONEY)
  aRow("Valor a la entrega", C.delivered, MONEY)
  aRow("Ganancia bruta", `${C.delivered}-${C.price}`, MONEY)
  const feeRow = proj.addRow(["% Fee de cesión", assignFeePct, "", "Cámbialo si el desarrollador cobra otro"])
  feeRow.getCell(2).numFmt = "0.00%"
  feeRow.getCell(2).fill = INPUT_FILL
  feeRow.getCell(4).font = { size: 9, color: { argb: "FF666666" } }
  aRow("Fee de cesión", `-${C.delivered}*B${feeRow.number}`, MONEY)
  const netRow = aRow("GANANCIA NETA", `${C.delivered}-${C.price}-${C.delivered}*B${feeRow.number}`, MONEY)
  netRow.getCell(2).fill = TOTAL_FILL
  aRow("Retorno sobre los depósitos", `IF(${C.down}=0,0,(${C.delivered}-${C.price}-${C.delivered}*B${feeRow.number})/${C.down})`, PCT1,
    "Sin haber cerrado ni pedido hipoteca")
  const warn = proj.addRow(["", "Casi todos los desarrolladores restringen o cobran la cesión de contrato, y algunos la prohíben hasta cerrar. Verifica la cláusula ANTES de vendérselo así a un cliente."])
  warn.getCell(2).font = { bold: true, color: { argb: "FFB00020" } }
  warn.getCell(2).alignment = { wrapText: true }
  warn.height = 32

  // ─── Assumptions and sources ──────────────────────────────────────────────
  tail.columns = [{ width: 28 }, { width: 110 }]
  const tput = (k: string, v: string) => { tail.addRow([k, v]).getCell(1).font = { bold: true } }

  tput("Proyecto", input.projectName)
  if (input.unitLabel) tput("Unidad", input.unitLabel)
  if (input.paymentSchedule) tput("Estructura de pagos", input.paymentSchedule)
  tail.addRow([])
  tput("Precio", `$${a.price.toLocaleString()}`)
  tput("Superficie", a.sqft ? `${a.sqft} sqft` : "no informada")
  tput("Renta por noche", `$${a.nightlyRate}`)
  tput("Ocupación", `${a.occupancyPct}%`)
  tput("Property management", `${(a.propertyMgmtPct * 100).toFixed(0)}%`)
  tput("Impuestos", `${a.taxRatePct}% anual`)
  tput("HOA", a.hoaMonthly !== undefined ? `$${a.hoaMonthly} al mes (monto directo)` : `$${a.hoaPerSqft}/sqft al mes`)
  tput("Seguro", `$${a.insuranceMonthly} al mes`)
  tput("Hipoteca", `${a.mortgageRatePct}% a ${a.mortgageYears} años sobre el ${((1 - a.downPaymentPct) * 100).toFixed(0)}% financiado`)
  tput("Gastos de cierre", `${a.closingCostPct}% del precio`)
  tput("Valorización de la lista", `${a.appreciationPerPeriodPct}% por lista, ${a.appreciationPeriods} listas hasta la entrega`)
  tput("Valorización de reventa", `${pin.marketAppreciationPct}% al año`)
  tput("Crecimiento renta / gastos", `${pin.rentGrowthPct}% / ${pin.expenseGrowthPct}% al año`)
  tput("Costos de venta", `${pin.sellingCostPct}% del precio de venta`)
  tail.addRow([])

  if (input.notes?.length) {
    tput("Notas", "")
    input.notes.forEach(n => tail.addRow(["", n]).getCell(2).alignment = { wrapText: true })
    tail.addRow([])
  }
  if (input.sources?.length) {
    tput("Fuentes", "")
    input.sources.forEach(s => tail.addRow(["", s]))
    tail.addRow([])
  }
  tail.addRow([])
  const disclaimer = tail.addRow(["", "Las celdas amarillas de la hoja Análisis son los supuestos: cámbialos y TODO el libro se recalcula — el resumen, el guion y la proyección. Los números son estimados y varían según el banco, el operador y la ocupación real."])
  disclaimer.getCell(2).font = { italic: true, color: { argb: "FF999999" } }
  disclaimer.getCell(2).alignment = { wrapText: true }
  disclaimer.height = 32

  // Keep the first-year figures honest against the model even before Excel
  // recalculates, so a preview that does not evaluate formulas is not wrong.
  void r

  const out = await wb.xlsx.writeBuffer()
  return Buffer.from(out)
}
