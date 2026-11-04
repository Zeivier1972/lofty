export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import Quiz from "./quiz"
import { ASSUMED_RATE, ESCROW_RATE, CLOSING_RATE } from "./estimate"

/**
 * /primera-casa — "¿Cuánta casa puedo comprar?" funnel for first-time buyers
 * in Florida (Spanish). Ad → quiz → estimate → Catherine's calendar, all on
 * one page, so a lead books the call while they are looking at their number
 * instead of waiting for a phone call they will not answer.
 *
 * Content rule: no current-rate claims, no program amounts or deadlines —
 * those change. Programs are described generically ("sujeto a requisitos").
 */

const BASE = "https://www.catherinegomezrealtor.com"
const PAGE_URL = `${BASE}/primera-casa`

const TITLE = "¿Cuánta casa puedo comprar en Florida? Calculadora para tu primera casa | Catherine Gomez"
const DESCRIPTION =
  "Calculadora gratis en español para compradores de primera vez en Florida: descubre en 2 minutos cuánta casa puedes comprar, tu pago mensual estimado, cuánto necesitas de entrada y si podrías usar asistencia para el pago inicial. Agenda tu plan con Catherine Gomez, Realtor en Miami."

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "cuánta casa puedo comprar",
    "calculadora de hipoteca en español",
    "comprar mi primera casa en Florida",
    "comprador de primera vez Miami",
    "asistencia para el pago inicial Florida",
    "préstamo FHA 3.5% Florida",
    "cuánto necesito para comprar una casa en Miami",
    "realtor que habla español Miami",
    "comprar casa con ITIN o crédito bajo",
    "pago inicial casa Florida",
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "¿Cuánta casa puedes comprar? Descúbrelo en 2 minutos",
    description: "Calculadora gratis para tu primera casa en Florida: precio, pago mensual y cuánto necesitas de entrada. En español.",
    url: PAGE_URL,
    type: "website",
    siteName: "Catherine Gomez Realtor",
    locale: "es_US",
    // opengraph-image.tsx / twitter-image.tsx generate the 1200x630 card.
  },
  twitter: {
    card: "summary_large_image",
    title: "¿Cuánta casa puedes comprar? Descúbrelo en 2 minutos",
    description: "Calculadora gratis para tu primera casa en Florida: precio, pago mensual y entrada. En español.",
  },
}

const FAQ: [string, string][] = [
  [
    "¿Cuánta casa puedo comprar con mi salario?",
    "Como regla general, los prestamistas buscan que el pago de la casa (hipoteca, impuestos y seguro) no pase de entre el 28% y el 31% de tu ingreso mensual bruto, y que el total de tus deudas, incluida la casa, no pase de entre el 36% y el 43%. Con un ingreso de hogar de $70,000 al año y pocas deudas, eso suele dar un pago de unos $1,600 a $1,800 al mes. La calculadora de esta página hace la cuenta con tus números.",
  ],
  [
    "¿Cuánto necesito de pago inicial para mi primera casa en Florida?",
    "Con un préstamo FHA el pago inicial mínimo es del 3.5% del precio si tu crédito es de 580 o más; algunos préstamos convencionales para primera vivienda aceptan el 3%. Además, calcula entre el 2% y el 5% del precio para gastos de cierre. En una casa de $300,000, el 3.5% son $10,500 más los gastos de cierre.",
  ],
  [
    "¿Hay ayuda para el pago inicial en Florida?",
    "Sí. Existen programas estatales y de los condados (por ejemplo en Miami-Dade y Broward) que ayudan con el pago inicial o los gastos de cierre a compradores de primera vez. Cada uno tiene límites de ingreso, de precio y de crédito, y los fondos cambian durante el año, así que hay que revisar cuál aplica a tu caso con un prestamista aprobado.",
  ],
  [
    "¿Qué crédito necesito para comprar una casa?",
    "Para un préstamo FHA con 3.5% de entrada, la mayoría de los prestamistas piden un puntaje de 580 o más; con entre 500 y 579 puede ser posible con 10% de entrada. Los préstamos convencionales normalmente piden 620 o más. Un mejor puntaje también te da una mejor tasa.",
  ],
  [
    "¿Quién cuenta como comprador de primera vez?",
    "Para la mayoría de los programas, eres comprador de primera vez si no has sido dueño de una vivienda principal en los últimos 3 años, aunque hayas tenido casa antes.",
  ],
  [
    "¿La calculadora es una pre-aprobación?",
    "No. Es una estimación para planear con una tasa supuesta. La pre-aprobación la da un prestamista después de revisar tu crédito, ingresos y documentos. En la llamada con Catherine te explica cómo obtenerla y con quién.",
  ],
  [
    "¿Cuánto cuesta hablar con Catherine?",
    "Nada. La llamada de 15 a 30 minutos es gratis y sin compromiso, por teléfono o Zoom, en español o inglés. En la compra de una casa la comisión del agente del comprador se negocia y muchas veces la cubre el vendedor; Catherine te lo explica antes de empezar.",
  ],
]

const STEPS: [string, string][] = [
  ["Responde 7 preguntas", "Ingreso, deudas, ahorros y crédito aproximados. Sin documentos ni revisión de crédito."],
  ["Mira tu rango de precio", "Precio estimado, pago mensual, entrada y gastos de cierre, al instante."],
  ["Agenda tu plan", "Elige un horario y Catherine te llama con tus números y los programas que podrían aplicarte."],
]

export default async function PrimeraCasaPage() {
  const config = await prisma.aIConfig.findFirst().catch(() => null)
  const phone = config?.realtorPhone || "305-283-0872"
  const waDigits = phone.replace(/\D/g, "")
  const whatsappUrl = `https://wa.me/${waDigits.length === 10 ? `1${waDigits}` : waDigits}?text=${encodeURIComponent(
    "Hola, quiero comprar mi primera casa y me gustaría saber cuánto puedo comprar.",
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
        areaServed: ["Miami-Dade, Florida", "Broward, Florida", "Palm Beach, Florida", "Florida, USA"],
        knowsLanguage: ["es", "en"],
      },
      {
        "@type": "WebApplication",
        name: "Calculadora: ¿Cuánta casa puedo comprar?",
        url: PAGE_URL,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web",
        inLanguage: "es",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        provider: { "@id": `${BASE}#agent` },
      },
      {
        "@type": "HowTo",
        name: "Cómo saber cuánta casa puedes comprar en Florida",
        inLanguage: "es",
        step: STEPS.map(([name, text], i) => ({ "@type": "HowToStep", position: i + 1, name, text })),
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map(([q, ans]) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: ans },
        })),
      },
    ],
  }

  const rates = Object.values(ASSUMED_RATE)

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="bg-gradient-to-b from-emerald-900 to-emerald-800 px-4 pb-24 pt-10 text-white sm:pt-14">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">Compradores de primera vez · Florida</p>
          <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-5xl">¿Cuánta casa puedes comprar? Descúbrelo en 2 minutos</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-emerald-50 sm:text-lg">
            Calculadora gratis en español: tu rango de precio, tu pago mensual y cuánto necesitas de entrada —
            y, si quieres, tu plan de compra con Catherine Gomez, Realtor en Miami.
          </p>
        </div>
      </header>

      <section className="mx-auto -mt-16 max-w-2xl px-4" aria-label="Calculadora">
        <Quiz whatsappUrl={whatsappUrl} />
      </section>

      <section className="mx-auto mt-16 max-w-4xl px-4">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">Cómo funciona</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 font-bold text-white">{i + 1}</span>
              <h3 className="mt-4 text-lg font-semibold">{t}</h3>
              <p className="mt-2 text-sm text-slate-600">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto mt-16 max-w-3xl px-4">
        <h2 className="text-2xl font-bold sm:text-3xl">Cómo calculamos tu estimado</h2>
        <div className="mt-4 space-y-3 text-slate-700">
          <p>
            Usamos los límites de deuda contra ingreso con los que suelen trabajar los prestamistas: un pago cómodo del
            28% de tu ingreso mensual bruto (36% sumando tus deudas) y un pago máximo del 31% (43% con deudas, el tope
            habitual de un préstamo FHA).
          </p>
          <p>
            El pago incluye capital e intereses a 30 años, más un estimado de impuestos a la propiedad, seguro de vivienda
            y seguro hipotecario ({Math.round(ESCROW_RATE * 1000) / 10}% del precio al año). La tasa es un supuesto según tu
            crédito (entre {Math.min(...rates)}% y {Math.max(...rates)}%), no una cotización. Los gastos de cierre se estiman
            en {Math.round(CLOSING_RATE * 100)}% del precio.
          </p>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-3xl px-4" aria-labelledby="faq">
        <h2 id="faq" className="text-2xl font-bold sm:text-3xl">Preguntas frecuentes</h2>
        <div className="mt-6 space-y-3">
          {FAQ.map(([q, ans]) => (
            <details key={q} className="group rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <summary className="cursor-pointer list-none font-semibold text-slate-900">
                <h3 className="inline">{q}</h3>
              </summary>
              <p className="mt-3 text-slate-700">{ans}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-3xl px-4 pb-20 text-center">
        <h2 className="text-2xl font-bold">¿Tienes una pregunta rápida?</h2>
        <p className="mt-2 text-slate-600">Escríbenos por WhatsApp y te respondemos en español.</p>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-700"
        >
          Escribir por WhatsApp
        </a>
        <p className="mt-10 text-xs leading-relaxed text-slate-500">
          Catherine Gomez Realtors Group · Florida. Las cifras de esta página son estimaciones con fines informativos y no
          constituyen una oferta de crédito, una pre-aprobación ni asesoría financiera. Los programas de asistencia están
          sujetos a requisitos y disponibilidad de fondos.
        </p>
      </section>
    </main>
  )
}
