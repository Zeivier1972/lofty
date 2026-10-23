/**
 * The investment projects that have a real page under /inversion.
 *
 * This exists because a webinar's `projectSlug` used to be a free-text field
 * whose value was rendered straight into a link. Type "millenial-park" instead
 * of "millenia-park" and the public page ships a 404 to every visitor — which
 * is exactly what happened on the first real webinar.
 *
 * So the slug is picked from this list in the admin form, validated against it
 * before it is stored, and checked again before the link renders. Adding a
 * project means adding its page under app/inversion AND a row here; the two
 * going together is the point.
 */

export type InvestmentProject = {
  slug: string
  /** What the dropdown shows. */
  name: string
  /** 1200x630-ish social card, also the webinar page's default cover. */
  og: string
  hero: string
}

export const INVESTMENT_PROJECTS: InvestmentProject[] = [
  {
    slug: "millenia-park",
    name: "Millenia Park — Orlando (renta garantizada 7%)",
    og: "/inversion/millenia-park/og.jpg",
    hero: "/inversion/millenia-park/hero.jpg",
  },
  {
    slug: "gz-tower",
    name: "GZ Tower — Orlando (hotel-residencias)",
    og: "/inversion/gz-tower/og.jpg",
    hero: "/inversion/gz-tower/hero.jpg",
  },
]

export function findProject(slug: string | null | undefined): InvestmentProject | null {
  if (!slug) return null
  return INVESTMENT_PROJECTS.find(p => p.slug === slug) || null
}
