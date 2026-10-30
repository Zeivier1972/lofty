/**
 * The project landing pages on the site, in one place — so Sofía can answer
 * "me interesa House of Wellness" with that project's page instead of asking
 * questions the person already answered, and so /proyectos and the DM bots
 * never drift apart. Add a row here when a new project page goes live.
 */

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.catherinegomezrealtor.com"

export type Project = {
  name: string
  place: string
  /** Path of the landing page. */
  href: string
  img: string
  alt: string
  summary: string
  highlight: string
  /** How people write it in a DM — accents and case are ignored. */
  match: RegExp
}

export const PROJECTS: Project[] = [
  {
    name: "Parkside Residences at Brickell",
    place: "Brickell, Miami",
    href: "/parkside",
    img: "/parkside/fachada-atardecer.jpg",
    alt: "Parkside Residences at Brickell al atardecer, edificio boutique de 8 pisos frente a Simpson Park",
    summary: "Edificio boutique de 8 pisos con 187 residencias amuebladas frente a Simpson Park, con 16,500 pies² de amenidades y programa de administración de alquileres.",
    highlight: "Estudios desde $490,000",
    match: /\bpark\s?side\b/,
  },
  {
    name: "House of Wellness",
    place: "Brickell, Miami",
    href: "/house-of-wellness",
    img: "/house-of-wellness/hero-brickell.jpg",
    alt: "House of Wellness Brickell: terraza en la azotea con piscina y vista al skyline de Miami",
    summary: "34 pisos y 656 residencias en el corazón de Brickell, con más de 22,000 pies² de amenidades de bienestar: spa, gimnasio, yoga y piscina en la azotea.",
    highlight: "Estudios desde $419,900",
    match: /\b(house of wellness|wellness|how brickell)\b/,
  },
  {
    name: "Millenia Park",
    place: "Orlando",
    href: "/inversion/millenia-park",
    img: "/inversion/millenia-park/hero.jpg",
    alt: "Millenia Park en Orlando, proyecto de preconstrucción con renta garantizada",
    summary: "Preconstrucción con lease-back del 7% y renta garantizada por 2 años, a 1 milla de The Mall at Millenia y 2 de Epic Universe.",
    highlight: "Desde $289,900",
    match: /\bmillen+ia\b/,
  },
  {
    name: "GZ Tower",
    place: "Orlando",
    href: "/inversion/gz-tower",
    img: "/inversion/gz-tower/hero.jpg",
    alt: "GZ Tower en Orlando, hotel-residencias amuebladas cerca de Universal Studios",
    summary: "357 residencias amuebladas tipo hotel a una milla de Universal Studios, con unidades lockout de dos llaves y programa de administración.",
    highlight: "Desde $219,900",
    match: /\bgz\s?tower\b|\bgz\b/,
  },
  {
    name: "Guía: invertir en Miami desde Costa Rica",
    place: "One Twenty Brickell, Miami",
    href: "/guias/inversionista-costa-rica",
    img: "/guias/one-twenty-brickell/01-exterior.jpg",
    alt: "Exterior de One Twenty Brickell en Miami",
    summary: "Cómo comprar preconstrucción en Miami siendo extranjero: financiamiento, rentabilidad y el proceso paso a paso, con One Twenty Brickell como ejemplo.",
    highlight: "Guía para inversionistas",
    match: /\b(one twenty|120 brickell|one twenty brickell)\b/,
  },
]

export function projectUrl(p: Project): string {
  return `${BASE}${p.href}`
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ")
}

/** The project a message (or a campaign name) is about, if it names exactly one. */
export function detectProject(text: string | null | undefined): Project | null {
  if (!text) return null
  const t = norm(text)
  const hits = PROJECTS.filter(p => p.match.test(t))
  return hits.length === 1 ? hits[0] : null
}

/**
 * Sofía's answer when someone asks about a project by name: the page, one
 * line of what makes it worth a look, and a call with Catherine — no
 * questions they already answered.
 */
export function projectReply(p: Project, firstName: string | null | undefined, bookUrl: string): string {
  const hi = firstName && !/^(facebook|instagram|lead|email)$/i.test(firstName) ? `¡Hola ${firstName.split(" ")[0]}! ` : "¡Hola! "
  return `${hi}Con gusto 😊 Aquí tienes toda la información de ${p.name} (${p.place}): precios, fotos, planos y plan de pagos:\n${projectUrl(p)}\n\n` +
    `${p.highlight}. ${p.summary}\n\n` +
    `Si quieres, Catherine te llama 15 minutos para explicarte disponibilidad y cómo funciona la compra. Elige tu hora aquí: ${bookUrl}`
}

/** One line per project, for AI prompts. */
export function projectsForPrompt(): string {
  return PROJECTS.map(p => `- ${p.name} (${p.place}) — ${p.highlight}: ${projectUrl(p)}`).join("\n")
}
