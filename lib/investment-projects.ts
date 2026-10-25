/**
 * The investment projects that have a real public page on the site.
 *
 * This exists because a webinar's `projectSlug` used to be a free-text field
 * whose value was rendered straight into a link. Type "millenial-park" instead
 * of "millenia-park" and the public page ships a 404 to every visitor — which
 * is exactly what happened on the first real webinar.
 *
 * So the slug is picked from this list in the admin form, validated against it
 * before it is stored, and checked again before the link renders.
 *
 * Each row carries its own `path` rather than assuming /inversion/<slug>. The
 * first version of this file did assume it, because it was built by listing
 * the app/inversion folder — which quietly left out House of Wellness, a
 * project page every bit as real as the other two that happens to live at the
 * site root because it predates that convention. A list that is wrong about
 * what exists is worse than no list.
 */

export type InvestmentProject = {
  slug: string
  /** What the dropdown shows. */
  name: string
  /** Where the page actually lives. Not every project sits under /inversion. */
  path: string
  /** 1200x630-ish social card, also the webinar page's default cover. */
  og: string
  hero: string
}

export const INVESTMENT_PROJECTS: InvestmentProject[] = [
  {
    slug: "millenia-park",
    name: "Millenia Park — Orlando (renta garantizada 7%)",
    path: "/inversion/millenia-park",
    og: "/inversion/millenia-park/og.jpg",
    hero: "/inversion/millenia-park/hero.jpg",
  },
  {
    slug: "gz-tower",
    name: "GZ Tower — Orlando (hotel-residencias)",
    path: "/inversion/gz-tower",
    og: "/inversion/gz-tower/og.jpg",
    hero: "/inversion/gz-tower/hero.jpg",
  },
  {
    // Lives at the root, not under /inversion — it predates that convention.
    slug: "house-of-wellness",
    name: "House of Wellness — Brickell (desde $419,900)",
    path: "/house-of-wellness",
    og: "/house-of-wellness/hero-brickell.jpg",
    hero: "/house-of-wellness/hero-brickell.jpg",
  },
]

export function findProject(slug: string | null | undefined): InvestmentProject | null {
  if (!slug) return null
  return INVESTMENT_PROJECTS.find(p => p.slug === slug) || null
}
