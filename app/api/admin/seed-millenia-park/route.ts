export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { randomUUID } from "crypto"

/**
 * Millenia Park (Orlando) — adds the project to the pre-construction portfolio
 * that the investment advisor reads.
 *
 * The advisor only knows the projects stored in the `preconstruction_projects`
 * setting; a project that is not in there cannot be analysed, and asking for one
 * by name returns the closest other project instead. This is the same shape the
 * Bulk import on the Pre-Construction page writes, so it can equally be pasted
 * there — this endpoint exists so it is one request instead of a long paste.
 *
 * It merges by name onto whatever is already stored and leaves every other
 * project untouched, so running it twice updates Millenia Park rather than
 * duplicating it.
 *
 * Numbers below come from the developer's price list and brochure. The
 * guaranteed rent is the advertised 7% lease-back: $394,900 x 7% / 12 is exactly
 * the $2,303.58 quoted for the Towers 1-4 two-bedroom. Note in
 * `investmentHighlights` that the rate is what is firm, so the advisor derives
 * the right monthly figure per unit instead of applying one unit's rent to
 * another unit's price.
 */

const SETTING_KEY = "preconstruction_projects"
const PAGE_URL = "https://www.catherinegomezrealtor.com/inversion/millenia-park"
const IMG = "https://www.catherinegomezrealtor.com/inversion/millenia-park"

const PROJECT = {
  name: "Millenia Park",
  developer: "",
  neighborhood: "Millenia / West Oak Ridge",
  city: "Orlando",
  zipCode: "32839",
  priceMin: 289900,
  priceMax: 449900,
  bedrooms: "1 rec + den, 2 rec + den, 3 rec",
  deliveryDate: "Torres 1-4: entrega inmediata · Torres 5-8: fin de 2027",
  status: "under_construction",
  propertyType: "Condominium",
  units: 960,
  url: PAGE_URL,
  estimatedROI: "7% bruto anual garantizado por 24 meses (lease-back del desarrollador)",
  downPayment:
    "Torres 5-8: 20% al contrato, 10% a los 30 días, 10% a los 90 días, 10% al top-off (techo), 50% al closing a fin de 2027. Torres 1-4: listas, se cierra de inmediato.",
  description:
    "960 unidades en 8 torres sobre 43 acres en el corredor Millenia de Orlando, con 25,000 sq ft comerciales y ~1,200,000 sq ft construidos. A 1 milla de The Mall at Millenia, 1.5 de Orlando Premium Outlets y 2 de Universal Epic Universe, con acceso directo a la I-4. Amenities: piscina estilo resort, club house, fitness, cancha de tenis, parque sobre el lago con pista de running, parque infantil y parque para perros. Interiores con cocinas estilo europeo, acero inoxidable, mesadas de granito y techos de 9 pies. Tamaños aprox.: A 750 sq ft, B 1,023 sq ft, C 1,215 sq ft (incluye balcón).",
  investmentHighlights: [
    "LEASE-BACK: el desarrollador garantiza la renta 24 meses al 7% anual SOBRE EL PRECIO DE COMPRA de la unidad. Lo firme es la tasa: la renta mensual de cada unidad es precio x 0.07 / 12. No apliques la renta de una unidad al precio de otra.",
    "Ejemplos: 2/2 tipo B Torres 1-4 ($394,900) = $2,303.58/mes, $27,642.96/año, $55,285.92 en 24 meses. El mismo tipo B en Torres 5-8 ($364,900) = $2,128.58/mes, $25,543.00/año.",
    "Al terminar los 2 años el inquilino se queda con contrato anual de 12 meses.",
    "PRECIOS Torres 1-4 (entrega inmediata): A y A1 SOLD OUT · B $394,900 · B1 $399,900 · C $449,900.",
    "PRECIOS Torres 5-8 (fin 2027): A $289,900 · A1 $299,900 · B $364,900 · B1 $379,900 · C $419,900.",
    "HOA mensual: A $187.13 · B $252.99 · C $281.88.",
    "Neto estimado 2/2 Torres 5-8: $25,543 renta − $3,035.88 HOA − ~$4,014 predial (est. 1.1%) − ~$1,800 seguro = ~$16,693 NOI, ~4.57% neto. Predial y seguro son ESTIMADOS, no cifras del desarrollador.",
    "Orlando: ocupación de alquiler sobre 95%, primer lugar en crecimiento de empleo 5 años seguidos, $4.7 mil millones de inversión en el aeropuerto, Lake Nona Medical City, Amazon, Lockheed Martin y UCF (69,000+ estudiantes).",
  ].join(" | "),
  photos: [`${IMG}/hero.jpg`, `${IMG}/pool.jpg`, `${IMG}/gallery-1.jpg`, `${IMG}/gallery-2.jpg`, `${IMG}/gallery-3.jpg`],
}

const key = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ")

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } })
  let projects: any[] = []
  if (row) {
    try {
      const parsed = JSON.parse(row.value)
      if (Array.isArray(parsed)) projects = parsed
    } catch {
      // A malformed setting would otherwise be silently replaced with a single
      // project, wiping the portfolio. Refuse instead and let a human look.
      return NextResponse.json(
        { error: "El setting preconstruction_projects no es JSON válido — no se tocó nada." },
        { status: 500 },
      )
    }
  }

  const idx = projects.findIndex(p => key(String(p?.name || "")) === key(PROJECT.name))
  let action: "created" | "updated"

  if (idx >= 0) {
    projects[idx] = { ...projects[idx], ...PROJECT, id: projects[idx].id || randomUUID() }
    action = "updated"
  } else {
    projects.push({ ...PROJECT, id: randomUUID() })
    action = "created"
  }

  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: JSON.stringify(projects) },
    update: { value: JSON.stringify(projects) },
  })

  return NextResponse.json({
    ok: true,
    action,
    project: PROJECT.name,
    portfolioSize: projects.length,
    projects: projects.map(p => p.name),
  })
}
