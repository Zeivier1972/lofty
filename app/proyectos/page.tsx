import type { Metadata } from "next"
import Link from "next/link"
import { PROJECTS } from "@/lib/projects"

/**
 * /proyectos — one page that links every project landing page on the site,
 * reached from the "PROJECTS" tab in the home navigation.
 *
 * The cards come from lib/projects.ts — the same list Sofía uses to answer
 * DMs about a project — so update that file when a project changes.
 */

const BASE = "https://www.catherinegomezrealtor.com"
const PAGE_URL = `${BASE}/proyectos`
const NAVY = "#1a3a5c"
const GOLD = "#c9a84c"

const TITLE = "Proyectos de inversión en Miami y Orlando | Catherine Gomez Realtor"
const DESCRIPTION =
  "Todos los proyectos de preconstrucción e inversión que presenta Catherine Gomez: Parkside Residences y House of Wellness en Brickell, Millenia Park y GZ Tower en Orlando, y la guía One Twenty Brickell. Precios, planes de pago y asesoría en español."

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "proyectos de preconstrucción Miami",
    "invertir en Miami",
    "invertir en Orlando",
    "apartamentos en Brickell",
    "Parkside Residences at Brickell",
    "House of Wellness Brickell",
    "Millenia Park Orlando",
    "GZ Tower Orlando",
    "Catherine Gomez Realtor",
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: PAGE_URL,
    type: "website",
    siteName: "Catherine Gomez Realtor",
    locale: "es_US",
    images: [{
      url: `${BASE}/parkside/fachada-atardecer.jpg`,
      width: 2000,
      height: 1125,
      alt: "Parkside Residences at Brickell al atardecer, uno de los proyectos de Catherine Gomez Realtor",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [`${BASE}/parkside/fachada-atardecer.jpg`],
  },
}

const FAQS: { q: string; a: string }[] = [
  {
    q: "¿Qué proyectos de inversión presenta Catherine Gomez?",
    a: "Parkside Residences at Brickell y House of Wellness en Brickell, Miami; Millenia Park y GZ Tower en Orlando; y una guía para invertir en One Twenty Brickell. Cada proyecto tiene su propia página con precios, plan de pagos y amenidades.",
  },
  {
    q: "¿Puedo comprar estos proyectos desde fuera de Estados Unidos?",
    a: "Sí. Los extranjeros pueden comprar propiedades en Florida a su nombre o a través de una sociedad. Catherine Gomez le acompaña en español durante todo el proceso, a distancia.",
  },
  {
    q: "¿Cómo recibo precios actualizados y planos?",
    a: "Abra la página del proyecto que le interesa y solicite información, o agende una cita con Catherine. Los precios y la disponibilidad cambian con frecuencia y se confirman con el desarrollador.",
  },
]

export default function ProyectosPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "RealEstateAgent",
        "@id": `${BASE}#agent`,
        name: "Catherine Gomez Realtor",
        url: BASE,
        areaServed: "Miami y Orlando, Florida, USA",
        knowsLanguage: ["es", "en"],
      },
      {
        "@type": "ItemList",
        name: "Proyectos de inversión de Catherine Gomez Realtor",
        url: PAGE_URL,
        itemListElement: PROJECTS.map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: p.name,
          url: `${BASE}${p.href}`,
          image: `${BASE}${p.img}`,
          description: p.summary,
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQS.map(f => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  }

  return (
    <main className="min-h-screen bg-[#f8f7f4] text-gray-900">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="text-sm font-black tracking-wider" style={{ color: NAVY }}>
            CATHERINE GOMEZ <span style={{ color: GOLD }}>REALTOR</span>
          </Link>
          <Link
            href="/book"
            className="rounded-full px-5 py-2.5 text-xs font-bold tracking-wider text-white transition hover:brightness-110"
            style={{ background: GOLD }}
          >
            AGENDAR CITA
          </Link>
        </div>
      </header>

      <section className="px-4 pb-10 pt-16 text-center sm:px-6 sm:pt-20" style={{ background: NAVY }}>
        <p className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: GOLD }}>Proyectos</p>
        <h1 className="mx-auto mt-4 max-w-3xl text-3xl font-black leading-tight text-white sm:text-5xl">
          Proyectos de inversión en Miami y Orlando
        </h1>
        <p className="mx-auto mt-5 max-w-2xl pb-8 text-base leading-relaxed text-white/75 sm:text-lg">
          Preconstrucción seleccionada por Catherine Gomez, con precios, planes de pago y asesoría
          en español para comprar desde cualquier país.
        </p>
      </section>

      <section className="mx-auto -mt-6 max-w-6xl px-4 pb-16 sm:px-6">
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PROJECTS.map(p => (
            <li key={p.href}>
              <Link
                href={p.href}
                className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="relative h-52 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.img}
                    alt={p.alt}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <span
                    className="absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] font-bold text-white"
                    style={{ background: "rgba(26,58,92,.85)" }}
                  >
                    {p.place}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="text-lg font-black leading-snug" style={{ color: NAVY }}>{p.name}</h2>
                  <p className="mt-1 text-sm font-bold" style={{ color: GOLD }}>{p.highlight}</p>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-gray-600">{p.summary}</p>
                  <span className="mt-4 text-sm font-bold" style={{ color: NAVY }}>
                    Ver el proyecto →
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-gray-500">
          Precios según la información más reciente de cada desarrollador; sujetos a cambio sin previo aviso.
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <h2 className="text-2xl font-black" style={{ color: NAVY }}>Preguntas frecuentes</h2>
        <div className="mt-6 divide-y divide-gray-200 border-y border-gray-200">
          {FAQS.map(f => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                <h3 className="font-bold text-gray-900">{f.q}</h3>
                <span className="text-lg transition group-open:rotate-45" style={{ color: GOLD }} aria-hidden="true">+</span>
              </summary>
              <p className="mt-3 leading-relaxed text-gray-600">{f.a}</p>
            </details>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link
            href="/new-construction"
            className="inline-block rounded-full border-2 px-6 py-3 text-sm font-bold transition hover:bg-[#1a3a5c] hover:text-white"
            style={{ borderColor: NAVY, color: NAVY }}
          >
            Ver toda la preconstrucción en Miami
          </Link>
        </div>
      </section>
    </main>
  )
}
