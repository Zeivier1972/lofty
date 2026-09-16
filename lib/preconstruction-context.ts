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

/**
 * A compact line per project — enough to decide which ones to discuss, and no
 * more. The full record is a tool call away (`get_project_details`), because
 * sending every description on every request put one question over the whole
 * per-minute token budget.
 */
export async function buildProjectContext(limit = 60): Promise<string[]> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: "preconstruction_projects" } })
    let projects: any[] = []
    try { if (setting) projects = JSON.parse(setting.value) } catch {}

    // An empty portfolio has to be stated, not left out. Sending nothing means
    // the model never learns a portfolio exists, so it quietly searches the web
    // and answers as though it had looked — which is how Catherine was told a
    // project she had just given us was "not in the portfolio".
    if (!Array.isArray(projects) || projects.length === 0) {
      return [`\nLA CARTERA DE CATHERINE ESTÁ VACÍA — no hay NINGÚN proyecto cargado en el CRM. No es que falte uno: no hay ninguno. Si Catherine pregunta por cualquier proyecto, dile exactamente esto: "todavía no tienes proyectos cargados en la cartera; ve a la página de Pre-Construction y usa el botón Bulk import para cargarlos". NO busques en la web como si fuera lo mismo, y NUNCA digas que un proyecto concreto "no está en la cartera" — no puedes saberlo, porque la cartera no tiene nada.`]
    }

    const lines = [`\nCARTERA DE CATHERINE — ${projects.length} proyecto(s). Es la fuente autoritativa e incluye proyectos exclusivos que NO están en línea; priorízalos siempre sobre la web. Esta es la vista resumida: para amenidades, plan de pagos completo, descripción o puntos de venta de un proyecto, llama a get_project_details con su nombre.`]

    projects.slice(0, limit).forEach(p => {
      const price = (p.priceMin || p.priceMax)
        ? `${p.priceMin ? `$${Number(p.priceMin).toLocaleString()}` : "?"}${p.priceMax ? `–$${Number(p.priceMax).toLocaleString()}` : "+"}`
        : "SIN PRECIO"
      lines.push(`• ${p.name} | ${[p.neighborhood, p.city].filter(Boolean).join(", ") || "?"} | ${p.developer || "sin desarrollador"} | ${price}${p.bedrooms ? ` | ${p.bedrooms}` : ""}${p.deliveryDate ? ` | entrega ${p.deliveryDate}` : ""}${p.estimatedROI ? ` | ROI declarado ${p.estimatedROI}` : ""}`)
    })
    if (projects.length > limit) lines.push(`(y ${projects.length - limit} más — usa list_portfolio para verlos todos)`)

    return lines
  } catch { return [] }
}

/** The full stored record, for when the advisor is discussing one project. */
export async function getProjectDetail(names: string[]): Promise<string> {
  const { loadPortfolio, findProject, explainMiss } = await import("@/lib/portfolio-lookup")
  const all = await loadPortfolio()
  if (all.length === 0) return explainMiss(undefined, { project: null, near: [], portfolioSize: 0, ambiguous: false })

  const out: string[] = []
  for (const name of names.slice(0, 6)) {
    const m = findProject(all, name)
    if (!m.project) { out.push(explainMiss(name, m)); continue }
    const p = m.project
    if (m.ambiguous) {
      out.push(`"${name}" encaja con ${[p.name, ...m.near.map((x: any) => x.name)].join(" o ")} — pregúntale a Catherine cuál.`)
      continue
    }
    out.push([
      `${p.name}${(p.neighborhood || p.city) ? ` (${[p.neighborhood, p.city].filter(Boolean).join(", ")})` : ""}`,
      p.developer ? `Desarrollador: ${p.developer}` : "",
      (p.priceMin || p.priceMax) ? `Precio: ${p.priceMin ? `$${Number(p.priceMin).toLocaleString()}` : "?"}${p.priceMax ? ` – $${Number(p.priceMax).toLocaleString()}` : "+"}` : "SIN PRECIO REGISTRADO",
      p.bedrooms ? `Recámaras: ${p.bedrooms}` : "",
      p.propertyType ? `Tipo: ${p.propertyType}` : "",
      p.units ? `Unidades: ${p.units}` : "",
      p.deliveryDate ? `Entrega: ${p.deliveryDate}` : "",
      p.status ? `Estado: ${p.status}` : "",
      p.estimatedROI ? `ROI declarado: ${p.estimatedROI}` : "",
      p.downPayment ? `Plan de pagos: ${p.downPayment}` : "",
      p.investmentHighlights ? `Puntos clave: ${p.investmentHighlights}` : "",
      p.description ? `Descripción: ${p.description}` : "",
    ].filter(Boolean).join("\n  "))
  }
  return out.join("\n\n")
}
