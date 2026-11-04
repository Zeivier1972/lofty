export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import { Cormorant_Garamond } from "next/font/google"
import { prisma } from "@/lib/prisma"
import Funnel from "./funnel"
import { UNITS, DEPOSITS, PRICES_AS_OF, usd } from "./data"

/**
 * /parkside/colombia — the Parkside ad funnel for Colombian investors.
 *
 * Separate from /parkside (the full project page, left as is). This one is
 * short on purpose: a promise above the fold ("su plan de inversión en
 * 60 segundos"), the quiz right there, a personalised plan, and Catherine's
 * Zoom calendar — the self-scheduling-at-peak-interest pattern, plus
 * qualification so the calendar fills with people who can actually buy.
 *
 * Content rule (same as /parkside): only the developer's material — "desde"
 * prices and the deposit schedule of 2026-10-27. No ROI, rent or HOA figures.
 */

const display = Cormorant_Garamond({ subsets: ["latin"], weight: ["300", "400", "500"], variable: "--font-display", display: "swap" })

const FOREST = "#1E2B23"
const CREAM = "#F6F3EC"
const SAND = "#B59A6A"
const SAND_LIGHT = "#D9C7A0"
const serif = "var(--font-display), Georgia, serif"

const BASE = "https://www.catherinegomezrealtor.com"
const PAGE_URL = `${BASE}/parkside/colombia`
const HERO = "/parkside/fachada-atardecer.jpg"
const WEBINAR_URL = `${BASE}/webinar/serie/inversion-miami`

const STUDIO = UNITS[0].from
const TITLE = "Invertir en Brickell desde Colombia: su plan para Parkside Residences | Catherine Gomez"
const DESCRIPTION =
  `¿Cuánto necesita para invertir en Miami desde Colombia? Responda 6 preguntas y reciba su plan de inversión en Parkside Residences at Brickell: residencia que encaja con su capital, depósitos en dólares y fechas (20% al contrato, desde ${usd(STUDIO * 0.2)}), y una presentación privada por Zoom con Catherine Gomez, en español.`

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "invertir en Miami desde Colombia",
    "invertir en Brickell desde Colombia",
    "comprar apartamento en Miami desde Colombia",
    "Parkside Residences at Brickell",
    "preconstrucción Miami colombianos",
    "cuánto necesito para invertir en Miami",
    "apartamentos amueblados Brickell precio",
    "plan de pagos preconstrucción Miami",
    "realtor en Miami que habla español",
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "¿Cuánto necesita para invertir en Brickell desde Colombia?",
    description: `Su plan de inversión en Parkside en 60 segundos: depósitos en dólares y fechas. Estudios desde ${usd(STUDIO)}.`,
    url: PAGE_URL,
    type: "website",
    siteName: "Catherine Gomez Realtor",
    locale: "es_CO",
    // opengraph-image.tsx / twitter-image.tsx generate the 1200x630 card.
  },
  twitter: {
    card: "summary_large_image",
    title: "¿Cuánto necesita para invertir en Brickell desde Colombia?",
    description: `Su plan de inversión en Parkside en 60 segundos. Estudios desde ${usd(STUDIO)}.`,
  },
}

const FAQ: [string, string][] = [
  [
    "¿Un colombiano puede comprar una propiedad en Miami?",
    "Sí. En Estados Unidos no se necesita ser residente ni tener visa para comprar una propiedad; muchos compradores de Parkside invierten desde el exterior. La firma y los pagos se pueden coordinar a distancia, y Catherine le explica cada paso en la presentación.",
  ],
  [
    "¿Cuánto necesito para invertir en Parkside?",
    `Según la lista del desarrollador del ${PRICES_AS_OF}, los estudios empiezan en ${usd(STUDIO)}. El calendario es: 20% al firmar el contrato (desde ${usd(STUDIO * 0.2)}), 10% en enero de 2027, 10% en abril de 2027 y 60% al cierre, con entrega estimada para el primer trimestre de 2028. La calculadora de esta página lo aplica a la residencia que encaja con su capital.`,
  ],
  [
    "¿Cómo se paga el 60% al cierre?",
    "Con fondos propios o con un crédito hipotecario. Existen opciones de financiamiento para compradores extranjeros; las condiciones dependen del banco y de su perfil, y Catherine le explica las alternativas en la presentación.",
  ],
  [
    "¿Qué incluye la presentación por Zoom?",
    "Es una reunión privada de 30 minutos, en español y sin costo. Catherine le muestra las residencias disponibles que encajan con su plan, planos y precios vigentes, los gastos a considerar además del precio y cómo se compra desde Colombia, y responde sus preguntas en vivo. Los horarios aparecen en hora de Colombia.",
  ],
  [
    "¿Qué es Parkside Residences at Brickell?",
    "Un edificio boutique de 8 pisos con 187 residencias amuebladas frente a Simpson Park, en Brickell, Miami, con 16,500 pies² de amenidades y un programa profesional de administración de alquileres.",
  ],
]

export default async function ParksideColombiaPage() {
  const config = await prisma.aIConfig.findFirst().catch(() => null)
  const phone = config?.realtorPhone || "305-283-0872"
  const waDigits = phone.replace(/\D/g, "")
  const waUrl = `https://wa.me/${waDigits.length === 10 ? `1${waDigits}` : waDigits}?text=${encodeURIComponent(
    "Hola, quiero información para invertir en Parkside Brickell desde Colombia.",
  )}`

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "RealEstateAgent",
        "@id": `${BASE}#agent`,
        name: "Catherine Gomez Realtors Group",
        url: BASE,
        telephone: phone,
        email: "info@catherinegomezrealtor.com",
        areaServed: ["Miami, Florida, USA", "Colombia", "Latinoamérica"],
        knowsLanguage: ["es", "en"],
      },
      {
        "@type": "Residence",
        name: "Parkside Residences at Brickell",
        url: `${BASE}/parkside`,
        image: `${BASE}${HERO}`,
        address: { "@type": "PostalAddress", addressLocality: "Miami", addressRegion: "FL", addressCountry: "US" },
        containedInPlace: { "@type": "Place", name: "Brickell, Miami" },
      },
      {
        "@type": "ItemList",
        name: "Residencias de Parkside Residences at Brickell — precios desde",
        itemListElement: UNITS.map((u, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "Product",
            name: `Parkside Residences at Brickell — ${u.type}`,
            offers: { "@type": "Offer", price: u.from, priceCurrency: "USD", availability: "https://schema.org/PreOrder" },
          },
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map(([q, ans]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: ans } })),
      },
    ],
  }

  const EYEBROW = "text-[11px] font-medium uppercase tracking-[0.3em]"

  return (
    <main className={`${display.variable} min-h-screen`} style={{ background: CREAM, color: FOREST }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero + funnel: the promise and the first question above the fold. */}
      <section className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO}
          alt="Parkside Residences at Brickell al atardecer, edificio boutique de 8 pisos frente a Simpson Park en Miami"
          className="absolute inset-0 h-[560px] w-full object-cover sm:h-[620px]"
        />
        <div className="absolute inset-x-0 top-0 h-[560px] sm:h-[620px]" style={{ background: "linear-gradient(to bottom, rgba(30,43,35,.55), rgba(30,43,35,.92))" }} />
        <div className="relative mx-auto grid max-w-6xl gap-6 sm:gap-10 px-4 pb-12 pt-8 sm:px-6 sm:pt-20 lg:grid-cols-[1fr_1.1fr] lg:items-start">
          <div className="text-white">
            <p className={EYEBROW} style={{ color: SAND_LIGHT }}>Parkside Residences · Brickell, Miami</p>
            <h1 className="mt-4 text-[2rem] font-light leading-[1.05] sm:text-[3.6rem]" style={{ fontFamily: serif }}>
              ¿Cuánto necesita para invertir en Brickell desde Colombia?
            </h1>
            <p className="mt-4 text-base text-white/80 sm:hidden">
              Responda 6 preguntas y vea su plan: cada pago en dólares, con fechas.
            </p>
            <p className="mt-5 hidden max-w-lg text-lg text-white/80 sm:block">
              Responda 6 preguntas y vea su plan de inversión en Parkside: la residencia que encaja con su capital y cada
              pago en dólares, con fechas. Luego, si quiere, una presentación privada por Zoom con Catherine Gomez.
            </p>
            <div className="mt-5 flex flex-wrap gap-x-10 gap-y-4 sm:mt-7">
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-white/55">Estudios desde</p>
                <p className="mt-1 text-2xl font-light sm:text-3xl" style={{ fontFamily: serif }}>{usd(STUDIO)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-white/55">20% al contrato</p>
                <p className="mt-1 text-2xl font-light sm:text-3xl" style={{ fontFamily: serif }}>{usd(STUDIO * 0.2)}</p>
              </div>
            </div>
          </div>
          <div id="plan">
            <Funnel waUrl={waUrl} webinarUrl={WEBINAR_URL} />
          </div>
        </div>
      </section>

      {/* Why trust this */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <ul className="grid gap-6 sm:grid-cols-3">
          {[
            ["Compra a distancia", "La firma y los pagos se coordinan desde Colombia, sin viajar en cada paso."],
            ["En español, de principio a fin", "Catherine Gomez le acompaña desde la primera llamada hasta la entrega."],
            ["Solo información del desarrollador", `Precios y calendario de depósitos según la lista del ${PRICES_AS_OF}.`],
          ].map(([t, d]) => (
            <li key={t} className="border-t pt-5" style={{ borderColor: "rgba(30,43,35,.2)" }}>
              <h2 className="text-xl font-light" style={{ fontFamily: serif }}>{t}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#4F5A52]">{d}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* The schedule in plain sight (also what answer engines quote) */}
      <section className="py-14" style={{ background: "#EDE7DA" }}>
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <p className={EYEBROW} style={{ color: SAND }}>Calendario de depósitos</p>
          <h2 className="mt-4 text-[2rem] font-light leading-tight sm:text-[2.6rem]" style={{ fontFamily: serif }}>
            Así se paga una residencia en Parkside
          </h2>
          <ol className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {DEPOSITS.map(d => (
              <li key={d.when} className="border-t pt-4" style={{ borderColor: "rgba(30,43,35,.2)" }}>
                <p className="text-4xl font-light" style={{ fontFamily: serif }}>{d.pct}%</p>
                <p className="mt-2 text-sm text-[#4F5A52]">{d.when}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm text-[#4F5A52]">
            Estudios desde {usd(UNITS[0].from)} · 1 habitación desde {usd(UNITS[1].from)} · 2 habitaciones desde {usd(UNITS[2].from)} USD.
          </p>
          <a href="#plan" className="mt-8 inline-block px-7 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-white" style={{ background: FOREST }}>
            Calcular mi plan
          </a>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6" aria-labelledby="faq">
        <p className={EYEBROW} style={{ color: SAND }}>Preguntas frecuentes</p>
        <h2 id="faq" className="mt-4 text-[2rem] font-light leading-tight sm:text-[2.6rem]" style={{ fontFamily: serif }}>
          Lo que preguntan los inversionistas colombianos
        </h2>
        <div className="mt-8">
          {FAQ.map(([q, ans]) => (
            <details key={q} className="group border-t py-5" style={{ borderColor: "rgba(30,43,35,.14)" }}>
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6">
                <h3 className="text-xl font-light leading-snug" style={{ fontFamily: serif }}>{q}</h3>
                <span className="mt-1 shrink-0 text-lg transition group-open:rotate-45" style={{ color: SAND }} aria-hidden="true">+</span>
              </summary>
              <p className="mt-3 leading-relaxed text-[#4F5A52]">{ans}</p>
            </details>
          ))}
        </div>
        <p className="mt-10 text-sm text-[#4F5A52]">
          ¿Quiere ver todo el proyecto — amenidades, galería y ubicación? <a href="/parkside" className="underline">Página completa de Parkside</a>
        </p>
      </section>

      <footer className="px-4 py-10 text-center text-xs leading-relaxed" style={{ background: FOREST, color: "rgba(255,255,255,.4)" }}>
        <p className="mx-auto max-w-3xl">
          Catherine Gomez Realtors Group · Miami, Florida. Parkside Residences at Brickell es un proyecto de BI Group USA.
          Las imágenes son representaciones artísticas. Precios, disponibilidad, calendario de depósitos y condiciones están
          sujetos a cambio sin previo aviso y se confirman por escrito en la documentación del desarrollador. Para las
          declaraciones correctas, consulte los documentos requeridos por la sección 718.503 de los Estatutos de Florida.
          Esta página no constituye una oferta de venta ni asesoría financiera, legal o tributaria.
        </p>
      </footer>
    </main>
  )
}
