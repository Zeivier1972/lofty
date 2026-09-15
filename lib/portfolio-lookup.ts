import { prisma } from "@/lib/prisma"

// Finding the right project by name, and — just as important — saying what was
// found when the match fails. A tool that answers "no encontré nada" leaves the
// model to invent an explanation, which is how the advisor ended up telling
// Catherine to go verify her own data with Catherine.

export type PortfolioProject = any

export async function loadPortfolio(): Promise<PortfolioProject[]> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: "preconstruction_projects" } })
    if (!row) return []
    const parsed = JSON.parse(row.value)
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

const norm = (s: string) =>
  s.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")  // meliá → melia
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

/** Any price we can model with — starting price, or the top of the range. */
export function priceOf(p: PortfolioProject): number | undefined {
  const min = Number(p?.priceMin)
  if (Number.isFinite(min) && min > 0) return min
  const max = Number(p?.priceMax)
  if (Number.isFinite(max) && max > 0) return max
  return undefined
}

export type Match = {
  project: PortfolioProject | null
  /** Other projects whose names overlap — offered when the match is weak. */
  near: PortfolioProject[]
  portfolioSize: number
  /** Another project matched just as well — "Domus" fits Park and Center alike. */
  ambiguous: boolean
}

export function findProject(all: PortfolioProject[], query: string | undefined): Match {
  const portfolioSize = all.length
  if (!query || !query.trim()) return { project: null, near: [], portfolioSize, ambiguous: false }

  const q = norm(query)
  const scored = all.map(p => {
    const n = norm(p.name || "")
    if (n === q) return { p, score: 100 }
    if (n.startsWith(q) || q.startsWith(n)) return { p, score: 80 }
    if (n.includes(q) || q.includes(n)) return { p, score: 60 }
    // Fall back to how many words they share, so "Domus Center" still finds
    // "Domus Brickell Center".
    const qw = new Set(q.split(" ").filter(w => w.length > 2))
    const nw = n.split(" ").filter(w => w.length > 2)
    const shared = nw.filter(w => qw.has(w)).length
    return { p, score: shared > 0 ? 10 * shared : 0 }
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score)

  if (scored.length === 0) return { project: null, near: [], portfolioSize, ambiguous: false }

  const best = scored[0]
  // A single shared word is a guess, not a match — offer it instead of assuming.
  if (best.score < 60 && scored.length > 1) {
    return { project: null, near: scored.slice(0, 5).map(x => x.p), portfolioSize, ambiguous: true }
  }
  const tied = scored.filter(x => x.score === best.score)
  return {
    project: best.p,
    near: scored.slice(1, 4).map(x => x.p),
    portfolioSize,
    ambiguous: tied.length > 1 && best.score < 100,
  }
}

/** What the tool says when it cannot proceed — always naming what it did find. */
export function explainMiss(query: string | undefined, m: Match): string {
  if (m.portfolioSize === 0) {
    return "La cartera está VACÍA — no hay ningún proyecto cargado en el CRM. Dile a Catherine que vaya a la página de Pre-Construction y use el botón \"Bulk import\" para cargar los proyectos. No busques en la web como si fuera lo mismo."
  }
  if (m.near.length > 0) {
    return `No encontré "${query}" exacto en la cartera (hay ${m.portfolioSize} proyectos). Los más parecidos: ${m.near.map(p => p.name).join(" · ")}. Pregúntale a Catherine cuál de esos quiere.`
  }
  return `No hay ningún proyecto parecido a "${query}" en la cartera de Catherine, que tiene ${m.portfolioSize} proyectos. Dile cuáles sí tienes antes de ofrecerle buscar en la web.`
}
