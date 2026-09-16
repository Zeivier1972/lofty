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
  "investment-workbook", "preconstruction-context",
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
  check("datos de renta: Brickell 68%", strCtx.includes("68%"))
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
  // de Brickell ($287/68%), no el promedio genérico de Miami.
  check("usa el submercado Brickell ($287/68%), no el genérico de Miami", mkt.adr === 287 && mkt.occupancyPct === 68 && mkt.level === "submarket", `${mkt.adr}/${mkt.occupancyPct} ${mkt.level}`)
  console.log(`         precio $${a.price.toLocaleString()} · flujo $${Math.round(r.cashFlowMonth)}/mes · CoC ${r.cashOnCashPct.toFixed(1)}% · cap ${r.capRatePct.toFixed(1)}%`)

  console.log("\n=== 5. COMP DE EDIFICIO Y RENTA LARGA ===")
  const palma = findProject(loaded, "Palma").project
  const pm = resolveStrAssumptions(palma.name, palma.neighborhood, palma.city)
  check("Palma usa el 87% de 72 Park, no el 45% de Miami Beach", pm.occupancyPct === 87 && pm.level === "building", `${pm.occupancyPct}% ${pm.level}`)
  const verdana = findProject(loaded, "Verdana").project
  check("Verdana se detecta como renta larga", isLongTermPlay(verdana.propertyType, verdana.name))
  const hollywood = findProject(loaded, "One Hollywood").project
  const hm = resolveStrAssumptions(hollywood.name, hollywood.neighborhood, hollywood.city)
  check("One Hollywood usa Hollywood ($234), no Miami", hm.adr === 234, `$${hm.adr} ${hm.label}`)

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
  check("el guion usa el down payment real", guideText.includes(`$${Math.round(r.downPayment).toLocaleString()}`), "busca " + Math.round(r.downPayment))
  // Las cifras del ejemplo original de la hoja de coaching: si aparecen, la
  // sustitución de tokens falló. Se prueba con un proyecto cuyo down payment
  // NO es $200,000, para que la coincidencia no pueda ser casual.
  const palmaA = { ...DEFAULTS, price: 745000, sqft: 572, hoaPerSqft: 1.9, nightlyRate: 280, occupancyPct: 87 }
  const palmaR = analyze(palmaA)
  const wb2 = await buildInvestmentWorkbook({ projectName: "Palma Miami Beach", assumptions: palmaA })
  const book2 = new ExcelJS.Workbook(); await book2.xlsx.load(wb2)
  let g2 = ""; book2.getWorksheet("Cómo explicarlo").eachRow(r2 => { g2 += String(r2.getCell(2).value || "") + "\n" })
  check("el guion NO trae las cifras del ejemplo de la hoja original",
    !g2.includes("$14,220") && !g2.includes("7.1%") && !g2.includes("$200,000"))
  check("el guion SÍ trae el down payment real de Palma ($298,000)",
    g2.includes(`$${Math.round(palmaR.downPayment).toLocaleString()}`), "esperaba " + Math.round(palmaR.downPayment))
  check("el guion trae el cash on cash real de Palma",
    g2.includes(`${palmaR.cashOnCashPct.toFixed(2)}%`), "esperaba " + palmaR.cashOnCashPct.toFixed(2) + "%")

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
