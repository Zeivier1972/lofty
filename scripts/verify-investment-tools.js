#!/usr/bin/env node
// End-to-end check of the investment tooling against a real database: the bulk
// import, the project lookup, the context both Catherine-facing agents read,
// the five indicators, the market-data tiers, the projection, the comparison
// and the generated workbook.
//
//   DATABASE_URL=postgresql://... node scripts/verify-investment-tools.js
//
// It writes to the `preconstruction_projects` and `market_insights` settings,
// so point it at a scratch database, never at production.

const path = require("path")
const { execFileSync } = require("child_process")
const fs = require("fs")

if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL. Usa una base de pruebas, no la de producción.")
  process.exit(2)
}

const ROOT = path.resolve(__dirname, "..")
const OUT = path.join(ROOT, "node_modules", ".verify-investment")

// The repo's tsconfig uses moduleResolution "bundler", which ts-node cannot
// load, so the libraries are compiled to CommonJS first.
const LIBS = [
  "prisma", "portfolio-lookup", "investment-analysis", "investment-explainers",
  "str-market-data", "investment-projection", "investment-compare",
  "investment-workbook", "preconstruction-context", "openai-errors",
]
fs.rmSync(OUT, { recursive: true, force: true })
// tsc exits non-zero because the "@/lib/..." aliases do not resolve under this
// standalone invocation, but it still emits the JavaScript, which is all this
// needs — the real typecheck is `npx tsc --noEmit -p tsconfig.json`.
try {
  execFileSync("npx", ["tsc", ...LIBS.map(f => `lib/${f}.ts`), "--outDir", OUT,
    "--module", "commonjs", "--target", "es2020", "--moduleResolution", "node",
    "--skipLibCheck", "--esModuleInterop", "--lib", "es2020,dom"],
    { cwd: ROOT, stdio: "ignore" })
} catch { /* emitted anyway; the file check below is what matters */ }

for (const f of LIBS) {
  const file = path.join(OUT, `${f}.js`)
  if (!fs.existsSync(file)) {
    console.error(`No se compiló lib/${f}.ts — corre "npx tsc --noEmit -p tsconfig.json" para ver el error.`)
    process.exit(2)
  }
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/require\("@\/lib\//g, 'require("./'))
}
const load = name => require(path.join(OUT, name))

const { prisma } = load("prisma")
const { loadPortfolio, findProject, priceOf, explainMiss } = load("portfolio-lookup")
const { DEFAULTS, analyze } = load("investment-analysis")
const { resolveStrAssumptions, isLongTermPlay, lookupLongTermComp, lookupAppreciation } = load("str-market-data")
const { project: projectYears, assignmentScenario } = load("investment-projection")
const { compare } = load("investment-compare")
const { buildInvestmentWorkbook } = load("investment-workbook")
const { buildProjectContext, buildMarketInsightsContext, buildStrMarketContext } = load("preconstruction-context")
const { describeOpenAIError, isOutOfCredit } = load("openai-errors")
const deck = require(path.join(ROOT, "data/preconstruction/colombia-event-2026.json"))

let pass = 0, fail = 0
const check = (name, cond, detail = "") => {
  if (cond) { pass++; console.log("  OK    " + name) }
  else { fail++; console.log("  FALLA " + name + (detail ? "  -> " + detail : "")) }
}

;(async () => {
  console.log("\n=== 1. BULK IMPORT (misma lógica de upsert que la ruta) ===")
  const { randomUUID } = require("crypto")
  const withIds = deck.map(p => ({ ...p, id: randomUUID() }))
  await prisma.setting.upsert({
    where: { key: "preconstruction_projects" },
    update: { value: JSON.stringify(withIds) },
    create: { key: "preconstruction_projects", value: JSON.stringify(withIds) },
  })
  const loaded = await loadPortfolio()
  check(`carga ${deck.length} proyectos desde la base`, loaded.length === deck.length, `leídos ${loaded.length}`)

  console.log("\n=== 1b. CARTERA VACÍA ===")
  // La falla que dejó a Catherine sin House of Wellness: sin proyectos cargados
  // el contexto iba vacío, el modelo nunca supo que existía una cartera, y
  // contestó "no está en la cartera" sobre algo que nunca miró.
  await prisma.setting.delete({ where: { key: "preconstruction_projects" } }).catch(() => {})
  const emptyCtx = (await buildProjectContext()).join("\n")
  check("con la cartera vacía el contexto NO va vacío", emptyCtx.trim().length > 0)
  check("dice explícitamente que está vacía", /VAC[IÍ]A/i.test(emptyCtx))
  check("prohíbe afirmar que un proyecto concreto no está", /NUNCA digas/i.test(emptyCtx))
  check("manda al Bulk import", /Bulk import/i.test(emptyCtx))
  // Restaurar para el resto de las pruebas.
  await prisma.setting.upsert({
    where: { key: "preconstruction_projects" },
    update: { value: JSON.stringify(withIds) },
    create: { key: "preconstruction_projects", value: JSON.stringify(withIds) },
  })

  console.log("\n=== 2. BÚSQUEDA (el bug de la captura) ===")
  const cases = [
    ["Domus Brickell Center", "Domus Brickell Center", 500000],
    ["domus brickell center", "Domus Brickell Center", 500000],
    ["Melia Residences", "Meliá Residences Miami", 540000],
    ["meliá", "Meliá Residences Miami", 540000],
    ["Nobe Parc", "NoBe Parc Residences", 545000],
    ["Elle", "ELLE Residences Miami", 585000],
    ["14 Roc", "14 Roc", 498000],
  ]
  for (const [q, expect, price] of cases) {
    const m = findProject(loaded, q)
    check(`"${q}" -> ${expect} @ $${price.toLocaleString()}`,
      m.project && m.project.name === expect && priceOf(m.project) === price,
      m.project ? `${m.project.name} @ ${priceOf(m.project)}` : "sin match")
  }
  const amb = findProject(loaded, "Domus")
  check('"Domus" se marca AMBIGUO (Park vs Center)', amb.ambiguous === true)
  const miss = findProject(loaded, "Proyecto Inventado")
  check("proyecto inexistente explica que hay 25 en cartera", explainMiss("Proyecto Inventado", miss).includes("25"))
  const empty = explainMiss(undefined, { project: null, near: [], portfolioSize: 0, ambiguous: false })
  check("cartera vacía manda al Bulk import", empty.includes("Bulk import"))

  console.log("\n=== 3. CONTEXTO QUE VEN EL ADVISOR Y ARIA ===")
  const ctx = (await buildProjectContext()).join("\n")
  check("la cartera va resumida, no completa (presupuesto de tokens)", ctx.length < 8000, `${ctx.length} caracteres`)
  check("el resumen apunta a get_project_details para el detalle", ctx.includes("get_project_details"))
  check("el contexto nombra Domus Brickell Center", ctx.includes("Domus Brickell Center"))
  check("el contexto trae su precio $500,000", ctx.includes("$500,000"))
  check("el contexto trae el desarrollador correcto", ctx.includes("North Development"))
  check("el contexto NO dice Desconocido", !ctx.includes("Desconocido"))
  const strCtx = buildStrMarketContext()
  check("datos de renta: Brickell 64.5%", strCtx.includes("64.5%"))
  check("datos de renta: comp del edificio Palma 87%", strCtx.includes("87%"))
  // Comprueba el concepto, no una frase exacta: que estén los dos números y que
  // se diga explícitamente que son distintos.
  check("valorización separa lista del desarrollador vs reventa",
    strCtx.includes("1.8%") && /lista de precios/i.test(strCtx) && /dos números distintos/i.test(strCtx))
  check("el contexto compacto cabe en el presupuesto de tokens",
    strCtx.length < 2500, `${strCtx.length} caracteres`)

  console.log("\n=== 4. ANÁLISIS (el que falló en la captura) ===")
  const dbc = findProject(loaded, "Domus Brickell Center").project
  const mkt = resolveStrAssumptions(dbc.name, dbc.neighborhood, dbc.city)
  const a = { ...DEFAULTS, price: priceOf(dbc), sqft: 500, nightlyRate: mkt.adr, occupancyPct: mkt.occupancyPct }
  const r = analyze(a)
  check("calcula sin error", Number.isFinite(r.cashOnCashPct) && Number.isFinite(r.roiPct))
  // Domus Brickell Center está EN Brickell, así que lo correcto es el submercado
  // de Brickell, no el promedio genérico de Miami. Las cifras son las que mide
  // PriceLabs para el zip 33131, no las estimaciones que traía la tabla antes.
  check("usa el submercado Brickell ($278/64.5%), no el genérico de Miami", mkt.adr === 278 && mkt.occupancyPct === 64.5 && mkt.level === "submarket", `${mkt.adr}/${mkt.occupancyPct} ${mkt.level}`)
  console.log(`         precio $${a.price.toLocaleString()} · flujo $${Math.round(r.cashFlowMonth)}/mes · CoC ${r.cashOnCashPct.toFixed(1)}% · cap ${r.capRatePct.toFixed(1)}%`)

  console.log("\n=== 5. COMP DE EDIFICIO Y RENTA LARGA ===")
  const palma = findProject(loaded, "Palma").project
  const pm = resolveStrAssumptions(palma.name, palma.neighborhood, palma.city)
  check("Palma usa el 87% de 72 Park, no el 52.5% de Miami Beach", pm.occupancyPct === 87 && pm.level === "building", `${pm.occupancyPct}% ${pm.level}`)
  const verdana = findProject(loaded, "Verdana").project
  check("Verdana se detecta como renta larga", isLongTermPlay(verdana.propertyType, verdana.name))
  const hollywood = findProject(loaded, "One Hollywood").project
  const hm = resolveStrAssumptions(hollywood.name, hollywood.neighborhood, hollywood.city)
  check("One Hollywood usa Hollywood ($285), no Miami", hm.adr === 285, `$${hm.adr} ${hm.label}`)

  console.log("\n=== 5b. LAS CIFRAS DE MERCADO SON LAS DE PRICELABS ===")
  // Los números de la tabla salían de estimaciones de AirDNA/AirROI/Rabbu y
  // algunos estaban lejos: Orlando 22% arriba, Hollywood 22% abajo. Ahora todos
  // vienen del índice STR de PriceLabs medido por zip. Si alguno se mueve sin
  // actualizar la fuente, esta prueba lo caza.
  const ESPERADO = {
    brickell:    { adr: 278, occ: 64.5 },
    miami_beach: { adr: 333, occ: 52.5 },
    hollywood:   { adr: 285, occ: 58.9 },
    orlando:     { adr: 205, occ: 55.3 },
    miami:       { adr: 247, occ: 59.1 },
  }
  const { STR_MARKETS, BUILDING_COMPS } = load("str-market-data")
  for (const [key, want] of Object.entries(ESPERADO)) {
    const row = STR_MARKETS.find(m => m.key === key)
    check(`${key}: $${want.adr}/${want.occ}% medidos por PriceLabs`,
      row && row.adr === want.adr && row.occupancyPct === want.occ,
      row ? `${row.adr}/${row.occupancyPct}` : "fila no encontrada")
  }
  check("toda fila de mercado cita su fuente PriceLabs",
    STR_MARKETS.every(m => /PriceLabs/i.test(m.source)),
    STR_MARKETS.filter(m => !/PriceLabs/i.test(m.source)).map(m => m.key).join(", ") || "todas")

  // Las cifras de los desarrolladores se conservan, pero no pueden viajar solas:
  // Catherine las va a decir en voz alta frente a un inversionista.
  for (const comp of BUILDING_COMPS) {
    check(`comp "${comp.label.slice(0, 28)}…" contrasta contra el mercado`,
      /PriceLabs/i.test(comp.note || "") && /(52\.5|64\.5)/.test(comp.note || ""),
      (comp.note || "").slice(0, 60))
  }

  console.log("\n=== 6. PROYECCIÓN Y SALIDA ===")
  const years = projectYears(a)
  check("proyecta 10 años", years.length === 10)
  check("el flujo acumulado crece", years[9].cumulativeCashFlow > years[0].cumulativeCashFlow)
  check("la hipoteca baja", years[9].loanBalance < years[0].loanBalance)
  const asg = assignmentScenario(a)
  check("cesión de contrato trae advertencia", asg.caveat.includes("restringen"))
  console.log(`         año 5: neto si vende $${Math.round(years[4].totalProfitIfSold).toLocaleString()} (${years[4].annualizedReturnPct.toFixed(1)}% anualizado)`)

  console.log("\n=== 7. COMPARACIÓN POR OBJETIVO DEL CLIENTE ===")
  const cands = [
    { project: findProject(loaded, "Meliá").project, sqft: 321 },
    { project: findProject(loaded, "Palma").project, sqft: 405 },
    { project: findProject(loaded, "14 Roc").project, sqft: 410 },
  ]
  const flujo = compare(cands, { goal: "flujo", budgetMax: 800000, capitalAvailable: 300000, horizonYears: 5 })
  check("puntúa los 3", flujo.length === 3)
  check("el ranking viene ordenado", flujo[0].score >= flujo[1].score && flujo[1].score >= flujo[2].score)
  check("cada uno trae razones o advertencias", flujo.every(x => x.reasons.length + x.warnings.length > 0))
  flujo.forEach((x, i) => console.log(`         ${i + 1}. ${x.name.padEnd(26)} CoC ${x.cashOnCashPct.toFixed(1)}%  flujo $${Math.round(x.cashFlowMonth)}`))

  console.log("\n=== 8. EXCEL ===")
  const wb = await buildInvestmentWorkbook({
    projectName: dbc.name, unitLabel: "Estudio · 500 sqft", assumptions: a,
    paymentSchedule: dbc.downPayment, notes: [`Mercado: ${mkt.label} (${mkt.source})`], sources: ["PriceLabs / AirDNA"],
  })
  check("genera el archivo", Buffer.isBuffer(wb) && wb.length > 10000, `${wb ? wb.length : 0} bytes`)
  const ExcelJS = require("exceljs")
  const book = new ExcelJS.Workbook()
  await book.xlsx.load(wb)
  const sheets = []; book.eachSheet(ws => sheets.push(ws.name))
  check("5 hojas en el orden correcto",
    sheets.join("|") === "Resumen para el cliente|Cómo explicarlo|Proyección y venta|Análisis|Supuestos y fuentes",
    sheets.join(" / "))
  check("la primera hoja es el resumen", sheets[0] === "Resumen para el cliente", sheets[0])
  const guide = book.getWorksheet("Cómo explicarlo")
  let guideText = ""; guide.eachRow(r => { guideText += String(r.getCell(2).value || "") + "\n" })
  // El guion pasó a ser fórmula viva, así que buscar el número impreso ya no
  // prueba nada: lo que hay que comprobar es que apunte a la celda correcta.
  const guideRows = []
  guide.eachRow(row => guideRows.push(row.getCell(2).value))
  const guideFormulas = guideRows.filter(v => v && typeof v === "object" && "formula" in v).map(v => String(v.formula))
  check("el guion trae frases como fórmula", guideFormulas.length >= 1, `${guideFormulas.length} frases`)
  check("la frase del cash on cash cita el down payment ($D$10)", guideFormulas.some(f => f.includes("$D$10")))
  check("la frase del cash on cash cita el flujo anual ($D$35)", guideFormulas.some(f => f.includes("$D$35")))
  check("la frase del cash on cash cita el indicador ($G$13)", guideFormulas.some(f => f.includes("$G$13")))
  // Ningún resto del ejemplo de la hoja original debe quedar impreso: las
  // cifras del guion viven en fórmulas, así que cualquier número fijo en esas
  // frases sería texto que ya no se recalcula.
  const palmaA = { ...DEFAULTS, price: 745000, sqft: 572, hoaPerSqft: 1.9, nightlyRate: 280, occupancyPct: 87 }
  const wb2 = await buildInvestmentWorkbook({ projectName: "Palma Miami Beach", assumptions: palmaA })
  const book2 = new ExcelJS.Workbook(); await book2.xlsx.load(wb2)
  let g2 = ""
  book2.getWorksheet("Cómo explicarlo").eachRow(r2 => {
    const v = r2.getCell(2).value
    g2 += (v && typeof v === "object" && "formula" in v ? String(v.formula) : String(v || "")) + "\n"
  })
  check("el guion no conserva las cifras del ejemplo original",
    !g2.includes("$14,220") && !g2.includes("7.1%") && !g2.includes("$200,000"))

  console.log("\n=== 8b. TODO EL LIBRO SE RECALCULA DESDE UNA SOLA HOJA ===")
  // Las cifras del resumen, la proyección y el guion tienen que ser FÓRMULAS
  // que apunten a "Análisis". Si alguna se convierte en número fijo, cambiar un
  // supuesto deja el libro a medio recalcular, que es peor que no recalcular.
  const isFormula = c => c && typeof c.value === "object" && c.value !== null && "formula" in c.value
  const refsModel = c => isFormula(c) && String(c.value.formula).includes("Análisis")

  const sumSheet = book.getWorksheet("Resumen para el cliente")
  const labelRow = name => {
    let found = null
    sumSheet.eachRow((row, i) => { if (String(row.getCell(1).value || "").trim() === name) found = i })
    return found
  }
  for (const label of ["Precio", "Renta estimada", "LE QUEDA EN EL BOLSILLO", "3. Cash on Cash", "4. ROI"]) {
    const rowNum = labelRow(label)
    check(`resumen: "${label}" es fórmula hacia Análisis`,
      rowNum !== null && refsModel(sumSheet.getCell(rowNum, 2)), rowNum === null ? "fila no encontrada" : "")
  }
  const cocRow = labelRow("3. Cash on Cash")
  check("el guion del resumen también es fórmula viva",
    cocRow !== null && refsModel(sumSheet.getCell(cocRow, 4)))

  const projSheet = book.getWorksheet("Proyección y venta")
  let projFormulas = 0, projLiterals = 0, rowsRefModel = 0, yearRows = 0
  projSheet.eachRow(row => {
    if (typeof row.getCell(1).value !== "number") return   // solo las filas de años
    yearRows++
    let rowRefs = false
    for (let c = 2; c <= 10; c++) {
      const cell = row.getCell(c)
      // Una celda como SUM($E$6:E6) o B6-G6 no nombra la hoja modelo, pero
      // sigue siendo viva: sus entradas sí la referencian.
      if (isFormula(cell)) { projFormulas++; if (refsModel(cell)) rowRefs = true }
      else if (cell.value !== null && cell.value !== undefined) projLiterals++
    }
    if (rowRefs) rowsRefModel++
  })
  check("la proyección entera son fórmulas, sin números fijos",
    projFormulas > 0 && projLiterals === 0, `${projFormulas} fórmulas, ${projLiterals} literales`)
  check("cada año de la proyección se alimenta de Análisis",
    yearRows > 0 && rowsRefModel === yearRows, `${rowsRefModel} de ${yearRows} filas`)

  const guideSheet = book.getWorksheet("Cómo explicarlo")
  let liveSentences = 0
  guideSheet.eachRow(row => { if (refsModel(row.getCell(2))) liveSentences++ })
  check("el guion trae frases vivas que citan la hoja", liveSentences >= 1, `${liveSentences} frases`)

  console.log("\n=== 8c. NINGUNA FÓRMULA LLEGA VACÍA AL ABRIR ===")
  // Excel en Vista Protegida NO recalcula: muestra el último valor que el
  // archivo trae guardado. Una fórmula sin ese valor sale como celda VACÍA,
  // que fue exactamente lo que le pasó a Catherine al abrir el libro. Cada
  // fórmula tiene que viajar con su resultado ya calculado dentro.
  const cachedAudit = b => {
    let withCache = 0
    const empties = []
    b.eachSheet(ws => {
      ws.eachRow(row => {
        row.eachCell({ includeEmpty: false }, cell => {
          const v = cell.value
          if (!v || typeof v !== "object" || !("formula" in v || "sharedFormula" in v)) return
          if (v.result === undefined || v.result === null || v.result === "") {
            empties.push(`${ws.name}!${cell.address}`)
          } else withCache++
        })
      })
    })
    return { withCache, empties }
  }
  for (const [label, b] of [["libro del análisis", book], ["libro de Palma", book2]]) {
    const { withCache, empties } = cachedAudit(b)
    check(`${label}: toda fórmula trae su valor guardado`,
      withCache > 0 && empties.length === 0,
      `${withCache} con valor, ${empties.length} vacías${empties.length ? ": " + empties.slice(0, 6).join(", ") : ""}`)
  }
  // Y el libro sigue pidiendo recálculo completo, para que al habilitar la
  // edición los números se actualicen solos al cambiar un supuesto. ExcelJS no
  // devuelve calcProperties al releer, así que hay que mirar el XML del .xlsx.
  const workbookXml = await require("jszip").loadAsync(wb).then(z => z.file("xl/workbook.xml").async("string"))
  check("el libro pide recalcular al abrirlo",
    /<calcPr[^>]*fullCalcOnLoad="1"/.test(workbookXml),
    (workbookXml.match(/<calcPr[^>]*>/) || ["sin calcPr"])[0])
  // Las filas que el cliente mira primero no pueden salir en blanco.
  const shownValue = (ws, label, col) => {
    let out
    ws.eachRow(row => {
      if (String(row.getCell(1).value || "").trim() !== label) return
      const v = row.getCell(col).value
      out = v && typeof v === "object" && "result" in v ? v.result : v
    })
    return out
  }
  for (const label of ["Precio", "Inicial que pone el cliente", "Renta estimada", "LE QUEDA EN EL BOLSILLO", "3. Cash on Cash"]) {
    const v = shownValue(book.getWorksheet("Resumen para el cliente"), label, 2)
    check(`resumen: "${label}" se ve al abrir`, v !== undefined && v !== null && v !== "", String(v))
  }

  console.log("\n=== 8d. EL ERROR DICE LO QUE HAY QUE ARREGLAR ===")
  // Dos veces hoy el mensaje mandó a Catherine a arreglar lo que no estaba
  // roto. OpenAI usa 429 tanto para "te pasaste de tokens este minuto" como
  // para "no tienes saldo", y esperar solo sirve para el primero.
  const sinSaldo = JSON.stringify({ error: {
    message: "You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.",
    type: "insufficient_quota", code: "insufficient_quota" } })
  const porMinuto = JSON.stringify({ error: {
    message: "Rate limit reached for gpt-4o in organization org-x on tokens per min (TPM): Limit 30000, Used 19146, Requested 13930. Please try again in 6.152s.",
    type: "tokens", code: "rate_limit_exceeded" } })

  const msgSaldo = describeOpenAIError(429, sinSaldo)
  check("sin saldo se reconoce aunque venga como 429", isOutOfCredit(429, "insufficient_quota", ""))
  check("sin saldo dice que hay que recargar", /sin saldo/i.test(msgSaldo) && msgSaldo.includes("billing"))
  check("sin saldo NO manda a subir el tier ni a esperar",
    !/sube el tier/i.test(msgSaldo) && !/Espera un minuto/i.test(msgSaldo), msgSaldo.slice(0, 90))

  const msgMinuto = describeOpenAIError(429, porMinuto)
  check("el rate limit real sigue diciendo que espere", /Espera un minuto/i.test(msgMinuto))
  check("el rate limit real no se confunde con falta de saldo",
    !isOutOfCredit(429, "rate_limit_exceeded", "Rate limit reached for gpt-4o on tokens per min (TPM)"))

  check("la key inválida sigue apuntando a Railway",
    describeOpenAIError(401, '{"error":{"code":"invalid_api_key"}}').includes("OPENAI_API_KEY"))

  console.log("\n=== 8e. EL ADVISOR NO PUEDE INVENTAR LA RENTA NI MENTIR SOBRE ADJUNTOS ===")
  // El advisor mandó un análisis de The Rider (Wynwood) calculado al 87% de
  // ocupación — la cifra de 72 Park, que no tiene nada que ver. Wynwood mide
  // 59.1%. Al 87% el negocio da +$1,067/mes; al real da -$587/mes. O sea, un
  // supuesto inventado convirtió una pérdida en una ganancia.
  const routeSrc = fs.readFileSync(path.join(ROOT, "app/api/investment-advisor/chat/route.ts"), "utf8")
  const between = (from, to) => {
    const i = routeSrc.indexOf(from)
    return i < 0 ? "" : routeSrc.slice(i, routeSrc.indexOf(to, i) + to.length)
  }
  const nightlyDesc = between("nightlyRate: { type:", "},")
  const occDesc = between("occupancyPct: { type:", "},")
  check("nightlyRate le prohíbe estimar al modelo",
    /ONLY pass this when Catherine/.test(nightlyDesc) && /Never estimate/i.test(nightlyDesc), nightlyDesc.slice(0, 70))
  check("occupancyPct le prohíbe estimar y copiar de otro proyecto",
    /ONLY pass this when Catherine/.test(occDesc) && /never borrow another project/i.test(occDesc), occDesc.slice(0, 70))
  check("un supuesto manual sale marcado como tal en la respuesta",
    routeSrc.includes("SUPUESTO MANUAL, NO DATO DE MERCADO") &&
    routeSrc.includes("const rateOverridden") && routeSrc.includes("const occOverridden"))

  // El correo decía "Attached is the detailed investment analysis" y no había
  // ningún adjunto: la herramienta no puede adjuntar archivos.
  const emailDesc = between('name: "send_email"', "parameters:")
  check("send_email dice que no puede adjuntar archivos", /CANNOT attach files/i.test(emailDesc))
  check("send_email prohíbe escribir \"adjunto\"", /Never write/i.test(emailDesc) && /adjunto/i.test(emailDesc))

  // La descripción mandaba al botón de la calculadora en vez del enlace que la
  // propia herramienta construye — por eso Catherine terminó buscando un botón.
  const analyzeDesc = between("Run Catherine's 5-indicator investment model", "parameters:")
  check("el análisis ya no manda a buscar el botón de la calculadora",
    !/calculator button/i.test(analyzeDesc) && /end your answer with that link/i.test(analyzeDesc))

  // Y el botón, cuando se usa, tiene que traer el panel a la vista: se dibuja
  // arriba de la grilla y el botón vive en la tarjeta, mucho más abajo.
  const pcSrc = fs.readFileSync(path.join(ROOT, "app/(dashboard)/pre-construction/pre-construction-client.tsx"), "utf8")
  check("el panel de la calculadora se trae a la vista al abrirlo",
    pcSrc.includes("calcRef") && pcSrc.includes("scrollIntoView") && /ref=\{calcRef\}/.test(pcSrc))

  console.log("\n=== 8f. LA CONVERSACIÓN DEL ADVISOR SOBREVIVE AL SALIR ===")
  // Cada respuesta cuesta tokens de OpenAI. Salir de la página borraba el
  // análisis y había que volver a pedirlo y volver a pagarlo.
  const advSrc = fs.readFileSync(path.join(ROOT, "app/(dashboard)/investment-advisor/advisor-client.tsx"), "utf8")
  check("la conversación se guarda en el navegador",
    advSrc.includes('STORE_KEY = "investment_advisor_chat_v1"') &&
    advSrc.includes("localStorage.setItem(STORE_KEY"))
  check("se restaura al volver a entrar", advSrc.includes("localStorage.getItem(STORE_KEY)"))
  // Sin este guard, el primer render con [] pisa lo guardado antes de leerlo.
  check("no se escribe antes de haber leído lo guardado",
    advSrc.includes("if (!loadedRef.current) return"))
  // Y si `contacts` cambia de identidad, restaurar otra vez borraría lo escrito.
  check("solo se restaura una vez", advSrc.includes("if (loadedRef.current) return"))
  // El botón de reset ya existía; lo que faltaba es que borrara la copia.
  check("empezar de cero borra también la copia guardada",
    advSrc.includes("localStorage.removeItem(STORE_KEY)"))
  check("y pregunta antes, porque ahora sí destruye trabajo pagado",
    /confirm\(/.test(advSrc.slice(advSrc.indexOf("function startNewChat"), advSrc.indexOf("function startNewChat") + 400)))
  // Guardar el objeto del contacto dejaría datos viejos del lead en pantalla.
  check("guarda el id del contacto, no el contacto entero",
    advSrc.includes("contactId: selectedContact?.id") && advSrc.includes("contacts.find(x => x.id === saved.contactId)"))

  console.log("\n=== 9. NOTAS DE MERCADO ===")
  const seeds = require(path.join(ROOT, "data/preconstruction/market-insights.json"))
  await prisma.setting.upsert({
    where: { key: "market_insights" },
    update: { value: seeds.map(s => s.text).join("\n\n") },
    create: { key: "market_insights", value: seeds.map(s => s.text).join("\n\n") },
  })
  const mi = await buildMarketInsightsContext()
  check("las notas llegan al contexto", mi && mi.includes("ORLANDO") && mi.includes("5.25%"))

  console.log(`\n${"=".repeat(46)}\n  ${pass} pruebas OK · ${fail} fallas\n${"=".repeat(46)}`)
  await prisma.$disconnect()
  process.exit(fail > 0 ? 1 : 0)
})().catch(e => { console.error("ERROR:", e); process.exit(1) })
