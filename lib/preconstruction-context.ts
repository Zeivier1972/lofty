import { prisma } from "@/lib/prisma"
import { strMarketContext } from "@/lib/str-market-data"

// Shared between the Investment Advisor and Aria: both are Catherine-facing, so
// both get the full record including the agent-only fields. Sofía deliberately
// does not use this — she talks to leads and gets the redacted view built by
// getMatchingPreConstruction in lib/social-ai-chat.ts.

/** Real ADR/occupancy/appreciation. Always present — it is code, not a setting. */
export function buildStrMarketContext(): string {
  return strMarketContext()
}

export async function buildMarketInsightsContext(): Promise<string | null> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: "market_insights" } })
    if (!row?.value?.trim()) return null
    return `\nCONOCIMIENTO DE MERCADO DE CATHERINE (úsalo como argumento de venta y cita sus números con exactitud):\n${row.value.trim()}`
  } catch { return null }
}

export async function buildProjectContext(limit = 40): Promise<string[]> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: "preconstruction_projects" } })
    if (!setting) return []
    const projects: any[] = JSON.parse(setting.value)
    if (projects.length === 0) return []

    // Catherine's own inventory is AUTHORITATIVE and often includes off-market
    // projects that are NOT online yet — neither agent can find these via web
    // search, so give them the full detail she entered on the Pre-Construction
    // page and tell them to prioritize + quote these accurately.
    const lines = [`\nPROYECTOS EN CARTERA DE CATHERINE (fuente autoritativa — incluye proyectos exclusivos/off-market que NO están en línea todavía; priorízalos y cita sus datos con exactitud):`]

    projects.slice(0, limit).forEach(p => {
      const header = `${p.name}${(p.neighborhood || p.city) ? ` (${[p.neighborhood, p.city].filter(Boolean).join(", ")})` : ""}`
      const priceRange = (p.priceMin || p.priceMax)
        ? `Precio: ${p.priceMin ? `$${Number(p.priceMin).toLocaleString()}` : "?"}${p.priceMax ? ` – $${Number(p.priceMax).toLocaleString()}` : "+"}`
        : ""
      const details = [
        p.developer ? `Desarrollador: ${p.developer}` : "",
        priceRange,
        p.bedrooms ? `Recámaras: ${p.bedrooms}` : "",
        p.propertyType ? `Tipo: ${p.propertyType}` : "",
        p.deliveryDate ? `Entrega: ${p.deliveryDate}` : "",
        p.estimatedROI ? `ROI estimado: ${p.estimatedROI}` : "",
        p.downPayment ? `Down payment: ${p.downPayment}` : "",
        p.status ? `Estado: ${p.status}` : "",
        p.investmentHighlights ? `Puntos clave: ${p.investmentHighlights}` : "",
        p.description ? `Descripción: ${p.description}` : "",
        (Array.isArray(p.photos) && p.photos[0]) ? `Foto: ${p.photos[0]}` : "",
      ].filter(Boolean).join(" · ")
      lines.push(`\n• ${header}\n  ${details}`)
    })

    return lines
  } catch { return [] }
}
