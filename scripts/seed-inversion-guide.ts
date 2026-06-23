/**
 * Run once to generate the INVERSIÓN lead magnet guide from the mortgage rates video script.
 * Usage (Railway Run Command): npx ts-node --project tsconfig.json scripts/seed-inversion-guide.ts
 */

import { generateGuideFromScript } from "../lib/generate-guide"

const SCRIPT = `Las tasas bajaron 0.75% este mes — aquí está lo que significa para tu cartera en Miami.

Esperar "a que bajen más" te está costando $200-300 dólares extra al mes por cada mes que dejas pasar. Los precios suben mientras que esperas.

Soy Catherine Gomez, Realtor en Miami con 15 años en South Florida. En junio 2026, las mortgage rates están en 6.2% — el mejor punto en 18 meses. Para first time homebuyer en Miami, esto significa diferencia de $80,000 en lo que vas a pagar en 30 años. He visto familias hispanas cerrar hipotecas este mes y ahorrar una casa completa.

Comenta "INVERSIÓN" abajo y te envío los números reales — cuánto ahorras hoy versus esperar tres meses más.`

async function main() {
  console.log("Generating INVERSIÓN guide from mortgage rates script...")
  const result = await generateGuideFromScript(SCRIPT)
  if (result) {
    console.log(`✅ Guide created!`)
    console.log(`   Keyword: ${result.keyword}`)
    console.log(`   Title:   ${result.title}`)
    console.log(`   URL:     ${result.guideUrl}`)
  } else {
    console.error("❌ Failed — no keyword found in script")
  }
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
