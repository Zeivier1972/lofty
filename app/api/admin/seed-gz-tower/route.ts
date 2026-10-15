export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { randomUUID } from "crypto"

/**
 * GZ Tower (Orlando) — adds the project to the pre-construction portfolio the
 * investment advisor reads. Same contract as seed-millenia-park: merges by name
 * onto the existing `preconstruction_projects` setting, touches no other
 * project, and refuses to write if the setting is not valid JSON.
 *
 * The important difference from Millenia Park, and the thing the advisor has to
 * get right: GZ Tower has NO guaranteed rent. Income depends on short-term
 * rental performance, and the developer publishes neither HOA nor a revenue
 * projection. `investmentHighlights` says so explicitly so the advisor quotes a
 * break-even rather than inventing a yield, since its whole job is to produce
 * return numbers and it will otherwise reach for whatever is at hand.
 */

const SETTING_KEY = "preconstruction_projects"
const PAGE_URL = "https://www.catherinegomezrealtor.com/inversion/gz-tower"
const IMG = "https://www.catherinegomezrealtor.com/inversion/gz-tower"

const PROJECT = {
  name: "GZ Tower",
  developer: "GZ Universal Developers LLC",
  neighborhood: "Universal / International Drive",
  city: "Orlando",
  zipCode: "",
  priceMin: 219900,
  priceMax: 422000,
  bedrooms: "Studio, 1 recámara, lockout de 2 llaves",
  deliveryDate: "Pre-construcción — confirmar fecha de entrega con el desarrollador",
  status: "under_construction",
  propertyType: "Condo-hotel",
  units: 357,
  url: PAGE_URL,
  estimatedROI: "SIN renta garantizada — el retorno depende del desempeño en renta corta",
  downPayment: "20% al contrato, 10% a los 90 días, 10% a los 6 meses, 10% al top-off, 50% al closing",
  description:
    "357 residencias amuebladas y equipadas tipo hotel en una torre de 17 pisos en el corredor turístico de Orlando, a 1 milla de Universal Studios y 1.7 de City Walk. Vistas panorámicas de 360°. Amenities: spa con salas de masaje, gimnasio (funcional, cardio, fuerza, yoga), coworking, lounge, restaurante y recepción 24/7. Unidades lockout de dos llaves que se rentan separadas o unidas. Programa de administración opcional con distribución multi-OTA, precios dinámicos, reservas centralizadas y reportes de ocupación y RevPAR; el propietario elige entre operadores calificados.",
  investmentHighlights: [
    "NO HAY RENTA GARANTIZADA. A diferencia de Millenia Park, aquí el ingreso depende del desempeño en renta corta. NUNCA inventes una proyección de ingresos ni un cap rate para este proyecto.",
    "El desarrollador NO publica HOA ni proyección de ingresos, así que NO existe una cifra neta confiable. Si el lead pide rendimiento, responde con el cálculo al revés: a 268 noches ocupadas al año (ocupación hotelera Orlando 73.5%, dato del propio desarrollador), la tarifa por noche necesaria para un 8% bruto es ~$66 en el studio de $219,900, ~$101 en la unidad de 1 recámara de $339,000 y ~$180 en el lockout de $604,000. Esa tarifa es INGRESO BRUTO, antes de comisiones OTA, management, limpieza, utilities, HOA, predial y seguro.",
    "INVENTARIO 08/26: 23 unidades, de $219,900 (studio 276 sq ft) a $422,000 (1 recámara 461 sq ft). Precio por pie cuadrado entre $757 y $926, promedio ~$826. La mejor relación $/sq ft del inventario actual es la 1009B (1 rec, 448 sq ft, $339,000 = $757/sq ft); la peor es la 1505A (studio, 299 sq ft, $277,000 = $926/sq ft).",
    "LOCKOUT: pares contiguos que se compran juntos y operan como una unidad de dos llaves. 701A+701B $604,000 (752 sq ft) · 1210C3+1210D3 $604,000 (729 sq ft) · 812A+812B $619,000 (752 sq ft) · 1106A+1106B $644,000 (760 sq ft) · 1503A+1503B $661,000 (752 sq ft) · 1505A+1505B $699,000 (760 sq ft).",
    "PLAN DE PAGOS: 20% al contrato, 10% a los 90 días, 10% a los 6 meses, 10% al top-off, 50% al closing. Se desembolsa el 50% durante la obra. Ojo: la presentación del desarrollador dice '9 meses' donde el Deposit Schedule dice '6 meses' — confirmar con el desarrollador antes de citar la fecha.",
    "Las residencias se entregan AMUEBLADAS, decoradas y equipadas — no hay que presupuestar mobiliario aparte, a diferencia de un condo convencional.",
    "UBICACIÓN: Hard Rock Hotel 1.1 mi · Universal City Walk 1.7 mi · Volcano Bay 1.7 mi · The Mall at Millenia 1.6 mi · Convention Center 4.7 mi · Magic Kingdom 6.9 mi · Epic Universe 7.6 mi · Disney World 8.7 mi · MCO 15 mi · Brightline 17.7 mi.",
    "ORLANDO: #1 metro de mayor crecimiento de EE. UU. en empleo, población y PIB nominal; 76M+ visitantes al año creciendo 7.4%; ocupación hotelera 73.5% en junio 2025 (+1.5% interanual) tras la apertura de Epic Universe; recaudo de impuesto turístico +10.3%, el junio más alto registrado; MCO con 57M+ pasajeros, por encima de Miami.",
    "Financiamiento: en producto condo-hotel las condiciones para extranjeros son más estrictas que en un condominio residencial. Revisarlo caso por caso antes de que el lead firme.",
  ].join(" | "),
  photos: [`${IMG}/hero.jpg`, `${IMG}/lobby.jpg`, `${IMG}/residencia.jpg`, `${IMG}/spa.jpg`, `${IMG}/aerial.jpg`],
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
