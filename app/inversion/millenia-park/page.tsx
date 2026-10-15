import type { Metadata } from "next"
import { Cormorant_Garamond, Jost } from "next/font/google"

const serif = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--mp-serif" })
const sans = Jost({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--mp-sans" })

const BASE = "https://www.catherinegomezrealtor.com"
const PAGE_URL = `${BASE}/inversion/millenia-park`
const OG_IMAGE = `${BASE}/inversion/millenia-park/og.jpg`
const IMG = "/inversion/millenia-park"

const PHONE_DISPLAY = "305.283.0872"
const PHONE_E164 = "+13052830872"
const WA_URL = `https://wa.me/13052830872?text=${encodeURIComponent("Hola Catherine, quiero información sobre Millenia Park en Orlando.")}`
const BOOK_URL = `${BASE}/book`

const TITLE = "Millenia Park Orlando — Inversión con renta garantizada 2 años | Catherine Gomez"
const DESCRIPTION =
  "Millenia Park, Orlando: pre-construcción con lease-back del 7% y renta garantizada por 2 años. Unidades 1, 2 y 3 recámaras desde $289,900, a 1 milla de The Mall at Millenia y 2 de Epic Universe. Precios, plan de pagos y números de inversión en español."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "Millenia Park Orlando",
    "invertir en Orlando",
    "pre-construcción Orlando",
    "renta garantizada Orlando",
    "lease back 7% Florida",
    "condos de inversión Orlando",
    "comprar propiedad en Orlando para rentar",
    "inversión inmobiliaria Florida para extranjeros",
    "Epic Universe bienes raíces",
    "The Mall at Millenia condos",
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: PAGE_URL,
    type: "website",
    siteName: "Catherine Gomez Realtor",
    locale: "es_US",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Millenia Park, Orlando — oportunidad de inversión con renta garantizada" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [OG_IMAGE] },
}

/* ------------------------------------------------------------------ data ---
 * Prices, HOA and the payment schedule come from the developer's price list
 * and are firm. The guaranteed rent is derived from the advertised 7% lease-back
 * rather than hard-coded, so every unit's figure stays consistent with the
 * program rate and with the $2,303.58 the developer quoted on the $394,900 unit
 * (394,900 x 7% / 12 = 2,303.58 exactly).
 */
const LEASE_BACK_RATE = 0.07
const monthlyLeaseBack = (price: number) => (price * LEASE_BACK_RATE) / 12

const usd = (n: number, decimals = 0) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`

type Unit = { type: string; layout: string; price: number | null; sqft?: number; hoa: number }

const TOWERS_1_4: Unit[] = [
  { type: "A / A1", layout: "1 Rec + Den", price: null, sqft: 750, hoa: 187.13 },
  { type: "B", layout: "2 Rec + Den / 2 Baños", price: 394900, sqft: 1023, hoa: 252.99 },
  { type: "B1", layout: "2 Rec + Den / 2 Baños", price: 399900, sqft: 1023, hoa: 252.99 },
  { type: "C", layout: "3 Rec / 2 Baños", price: 449900, sqft: 1215, hoa: 281.88 },
]

const TOWERS_5_8: Unit[] = [
  { type: "A", layout: "1 Rec + Den", price: 289900, sqft: 750, hoa: 187.13 },
  { type: "A1", layout: "1 Rec + Den", price: 299900, sqft: 750, hoa: 187.13 },
  { type: "B", layout: "2 Rec + Den / 2 Baños", price: 364900, sqft: 1023, hoa: 252.99 },
  { type: "B1", layout: "2 Rec + Den / 2 Baños", price: 379900, sqft: 1023, hoa: 252.99 },
  { type: "C", layout: "3 Rec / 2 Baños", price: 419900, sqft: 1215, hoa: 281.88 },
]

const PAYMENT_PLAN = [
  { pct: 20, when: "Al contrato (firma)" },
  { pct: 10, when: "A los 30 días" },
  { pct: 10, when: "A los 90 días" },
  { pct: 10, when: "Top-off — al terminar el techo" },
  { pct: 50, when: "Al closing — fin de 2027" },
]

/** Carrying costs. Only HOA is a developer figure; the rest are clearly labelled estimates. */
const TAX_RATE_EST = 0.011
const INSURANCE_EST = 1800

function netIncome(price: number, hoaMonthly: number) {
  const gross = monthlyLeaseBack(price) * 12
  const hoa = hoaMonthly * 12
  const tax = price * TAX_RATE_EST
  const noi = gross - hoa - tax - INSURANCE_EST
  return { gross, hoa, tax, insurance: INSURANCE_EST, noi, netYield: (noi / price) * 100 }
}

const FEATURED_1_4 = TOWERS_1_4.find(u => u.type === "B")!
const FEATURED_5_8 = TOWERS_5_8.find(u => u.type === "B")!
const NET_1_4 = netIncome(FEATURED_1_4.price!, FEATURED_1_4.hoa)
const NET_5_8 = netIncome(FEATURED_5_8.price!, FEATURED_5_8.hoa)

const POIS = [
  { group: "Atracciones y retail", items: [["The Mall at Millenia", "1 milla"], ["Orlando Premium Outlets", "1.5 millas"], ["Universal Epic Universe", "2 millas"], ["Universal Studios", "2 millas"], ["The Florida Mall", "2.5 millas"]] },
  { group: "Transporte", items: [["Sand Lake SunRail", "7.5 millas"], ["Downtown Orlando", "7.7 millas"], ["Brightline Station", "10 millas"], ["Orlando International Airport", "10.1 millas"]] },
  { group: "Escuelas y trabajo", items: [["Westridge Middle School", "0.3 millas"], ["International Drive", "1.5 millas"], ["Amazon Warehouse", "11.2 millas"], ["Orlando VA Lake Nona", "15 millas"]] },
]

const AMENITIES = [
  "Piscina estilo resort",
  "Club House para eventos",
  "Fitness con zona de cardio y vista a la piscina",
  "Cancha de tenis",
  "Parque sobre el lago con pista de running",
  "Parque infantil y parque para perros",
  "Seguridad y cámaras de última generación",
]

const INTERIORS = [
  "Cocinas estilo europeo con electrodomésticos de acero inoxidable",
  "Mesadas de granito",
  "Baños con espejos y apliques contemporáneos",
  "Amplios vestidores en la mayoría de las unidades",
  "Plantas abiertas con techos de 9 pies",
  "25,000 sq ft de espacio comercial en la comunidad",
]

/* FAQ — visible on the page and mirrored into FAQPage JSON-LD, which is what
 * Google AI Overviews, ChatGPT and Perplexity quote. */
const FAQS: { q: string; a: string }[] = [
  {
    q: "¿Qué es el lease-back de Millenia Park?",
    a: "Es un programa del desarrollador que garantiza la renta de tu unidad durante los primeros 24 meses a una tasa del 7% anual sobre el precio de compra. Cobras desde el closing sin tener que buscar inquilino. Al terminar los dos años, el inquilino se queda contigo con un contrato anual de 12 meses.",
  },
  {
    q: "¿Cuánto es la renta garantizada de una unidad de 2 recámaras?",
    a: `Sobre la unidad tipo B de las Torres 1 a 4 ($394,900) la renta garantizada es de ${usd(monthlyLeaseBack(394900), 2)} al mes, es decir ${usd(monthlyLeaseBack(394900) * 12, 2)} al año y ${usd(monthlyLeaseBack(394900) * 24, 2)} en los 24 meses garantizados. Sobre la misma unidad en las Torres 5 a 8 ($364,900) el 7% equivale a ${usd(monthlyLeaseBack(364900), 2)} al mes.`,
  },
  {
    q: "¿Cuándo puedo cerrar y empezar a cobrar renta?",
    a: "Las Torres 1 a 4 están listas: se puede cerrar de inmediato apenas el comprador esté listo, y la renta garantizada arranca desde el closing. Las Torres 5 a 8 se entregan a fin de 2027 y se compran con plan de pagos durante la obra.",
  },
  {
    q: "¿Cuál es el plan de pagos de las Torres 5 a 8?",
    a: "20% al firmar el contrato, 10% a los 30 días, 10% a los 90 días, 10% al terminar el techo (top-off) y el 50% restante al closing a fin de 2027. En total se desembolsa la mitad durante la obra.",
  },
  {
    q: "¿Dónde queda Millenia Park?",
    a: "En West Oak Ridge Road, Orlando, FL 32839, dentro del corredor Millenia: a 1 milla de The Mall at Millenia, 1.5 millas de Orlando Premium Outlets y 2 millas de Universal Epic Universe, con acceso directo a la I-4.",
  },
  {
    q: "¿Puede comprar un extranjero sin residencia en Estados Unidos?",
    a: "Sí. No se necesita ser residente ni ciudadano estadounidense para comprar en Florida. Se puede comprar a nombre propio o mediante una LLC, y existen préstamos para extranjeros (foreign national loans) que normalmente piden entre 30% y 50% de enganche, sin historial de crédito en Estados Unidos.",
  },
  {
    q: "¿Cuánto son los gastos mensuales de la unidad?",
    a: `El HOA mensual es de ${usd(187.13, 2)} para el tipo A, ${usd(252.99, 2)} para el tipo B y ${usd(281.88, 2)} para el tipo C. A eso se suman el impuesto predial y el seguro, que varían según la unidad y el comprador.`,
  },
  {
    q: "¿Cuántas unidades tiene el proyecto?",
    a: "Millenia Park son 960 unidades residenciales distribuidas en 8 torres sobre 43 acres, con 25,000 pies cuadrados de espacio comercial y aproximadamente 1,200,000 pies cuadrados construidos.",
  },
]

const ALL_UNITS = [...TOWERS_1_4, ...TOWERS_5_8].filter(u => u.price !== null)
const PRICE_MIN = Math.min(...ALL_UNITS.map(u => u.price!))
const PRICE_MAX = Math.max(...ALL_UNITS.map(u => u.price!))

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "RealEstateAgent",
      "@id": `${BASE}#agent`,
      name: "Catherine Gomez Realtor",
      image: `${BASE}/inversion/millenia-park/og.jpg`,
      telephone: PHONE_E164,
      email: "info@catherinegomezrealtor.com",
      url: BASE,
      areaServed: [
        { "@type": "City", name: "Orlando", addressRegion: "FL" },
        { "@type": "City", name: "Miami", addressRegion: "FL" },
      ],
      knowsLanguage: ["es", "en"],
    },
    {
      "@type": "ApartmentComplex",
      "@id": `${PAGE_URL}#project`,
      name: "Millenia Park",
      description: DESCRIPTION,
      url: PAGE_URL,
      image: [`${BASE}${IMG}/hero.jpg`, `${BASE}${IMG}/pool.jpg`, `${BASE}${IMG}/gallery-1.jpg`],
      numberOfAccommodationUnits: 960,
      address: {
        "@type": "PostalAddress",
        streetAddress: "West Oak Ridge Road",
        addressLocality: "Orlando",
        addressRegion: "FL",
        postalCode: "32839",
        addressCountry: "US",
      },
      amenityFeature: AMENITIES.map(a => ({ "@type": "LocationFeatureSpecification", name: a, value: true })),
      broker: { "@id": `${BASE}#agent` },
    },
    {
      "@type": "ItemList",
      name: "Tipos de unidad y precios — Millenia Park",
      itemListElement: ALL_UNITS.map((u, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "Apartment",
          name: `Millenia Park — Tipo ${u.type} (${u.layout})`,
          floorSize: u.sqft ? { "@type": "QuantitativeValue", value: u.sqft, unitCode: "FTK" } : undefined,
          offers: {
            "@type": "Offer",
            price: u.price,
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
            url: PAGE_URL,
          },
        },
      })),
    },
    {
      "@type": "Product",
      name: "Millenia Park — unidades de inversión en Orlando",
      image: `${BASE}${IMG}/hero.jpg`,
      description: "Unidades de pre-construcción en Orlando con programa de lease-back del 7% y renta garantizada por 24 meses.",
      brand: { "@type": "Brand", name: "Millenia Park" },
      offers: {
        "@type": "AggregateOffer",
        lowPrice: PRICE_MIN,
        highPrice: PRICE_MAX,
        priceCurrency: "USD",
        offerCount: ALL_UNITS.length,
        url: PAGE_URL,
      },
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

/* --------------------------------------------------------------- helpers --- */
function Eyebrow({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) {
  return (
    <p className={`text-[0.68rem] font-medium uppercase tracking-[0.34em] ${onDark ? "text-[#C7A869]" : "text-[#A6823B]"}`}>
      {children}
    </p>
  )
}

function Rule({ onDark = false }: { onDark?: boolean }) {
  return <div className={`my-5 h-px w-12 ${onDark ? "bg-[#C7A869]" : "bg-[#A6823B]"}`} />
}

function PriceTable({ caption, units, note }: { caption: string; units: Unit[]; note?: string }) {
  return (
    <div className="mt-8 overflow-x-auto rounded-lg border border-[#E1DACA] bg-[#FBF9F3]">
      <table className="w-full min-w-[520px] border-collapse text-left">
        <caption className="px-5 pt-5 pb-3 text-left font-[family-name:var(--mp-serif)] text-xl text-[#17160F]">
          {caption}
        </caption>
        <thead>
          <tr className="border-y border-[#E1DACA] text-[0.72rem] uppercase tracking-[0.18em] text-[#7C776A]">
            <th scope="col" className="px-5 py-3 font-medium">Tipo</th>
            <th scope="col" className="px-5 py-3 font-medium">Distribución</th>
            <th scope="col" className="px-5 py-3 font-medium">Aprox.</th>
            <th scope="col" className="px-5 py-3 text-right font-medium">Precio</th>
            <th scope="col" className="px-5 py-3 text-right font-medium">Renta garantizada</th>
          </tr>
        </thead>
        <tbody>
          {units.map(u => (
            <tr key={u.type} className="border-b border-[#E1DACA] last:border-0">
              <td className="px-5 py-4 font-medium text-[#17160F]">{u.type}</td>
              <td className="px-5 py-4 text-[#17160F]">{u.layout}</td>
              <td className="px-5 py-4 tabular-nums text-[#7C776A]">{u.sqft ? `${u.sqft.toLocaleString()} sq ft` : "—"}</td>
              <td className="px-5 py-4 text-right tabular-nums font-medium text-[#17160F]">
                {u.price === null ? <span className="text-[0.72rem] uppercase tracking-[0.18em] text-[#7C776A]">Sold out</span> : usd(u.price)}
              </td>
              <td className="px-5 py-4 text-right tabular-nums text-[#A6823B]">
                {u.price === null ? "—" : `${usd(monthlyLeaseBack(u.price), 2)}/mes`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {note && <p className="px-5 pb-5 pt-1 text-sm text-[#7C776A]">{note}</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ page --- */
export default function MilleniaParkPage() {
  return (
    <main className={`${serif.variable} ${sans.variable} bg-[#F3F0E8] font-[family-name:var(--mp-sans)] text-[#17160F]`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ---------- HERO ---------- */}
      <header className="relative flex min-h-[70vh] items-end overflow-hidden bg-[#17130E]">
        <img
          src={`${IMG}/hero.jpg`}
          alt="Millenia Park, Orlando — torres residenciales frente al lago de la comunidad"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0c0a07]/35 via-[#0c0a07]/20 to-[#0c0a07]/90" />
        <div className="relative mx-auto w-full max-w-5xl px-5 pb-12 pt-28 sm:pb-16">
          <Eyebrow onDark>Oportunidad de inversión · Orlando</Eyebrow>
          <h1 className="mt-3 font-[family-name:var(--mp-serif)] text-5xl font-medium leading-[0.95] text-white sm:text-7xl lg:text-8xl">
            Millenia&nbsp;Park
          </h1>
          <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#ECE5D5] sm:text-base">
            <span>West Oak Ridge Road, Orlando, FL 32839</span>
            <span className="text-[#C7A869]">·</span>
            <span>Pre-construcción</span>
            <span className="text-[#C7A869]">·</span>
            <span>Renta garantizada 2 años</span>
          </p>
        </div>
      </header>

      {/* ---------- FACTS BAR ---------- */}
      <section aria-label="Datos principales" className="border-y border-[#E1DACA] bg-[#FBF9F3]">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-px px-5 py-8 sm:grid-cols-4">
          {[
            { k: "2/2 desde", v: usd(FEATURED_5_8.price!) },
            { k: "Renta garantizada", v: `${usd(monthlyLeaseBack(FEATURED_1_4.price!), 2)}`, small: "/mes · Torres 1–4" },
            { k: "Lease-back", v: "7%", small: "bruto · 24 meses" },
            { k: "Torres 1–4", v: "Cierra ya", small: "Torres 5–8: fin 2027" },
          ].map(f => (
            <div key={f.k} className="px-2">
              <p className="text-[0.68rem] uppercase tracking-[0.2em] text-[#7C776A]">{f.k}</p>
              <p className="mt-2 font-[family-name:var(--mp-serif)] text-2xl tabular-nums text-[#17160F] sm:text-3xl">
                {f.v}
                {f.small && <span className="ml-1 block text-[0.7rem] tracking-wide text-[#7C776A] sm:inline sm:text-xs">{f.small}</span>}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- LEASE-BACK ---------- */}
      <section className="bg-[#17130E] text-[#ECE5D5]">
        <div className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
          <Eyebrow onDark>El incentivo</Eyebrow>
          <Rule onDark />
          <h2 className="font-[family-name:var(--mp-serif)] text-4xl font-medium leading-[1.05] text-white sm:text-5xl">
            Lease-back de dos años,<br />renta garantizada
          </h2>
          <div className="mt-10 flex flex-wrap gap-x-14 gap-y-6">
            <p className="font-[family-name:var(--mp-serif)] text-4xl tabular-nums text-[#C7A869] sm:text-5xl">
              {usd(monthlyLeaseBack(FEATURED_1_4.price!), 2)}
              <span className="mt-1 block font-[family-name:var(--mp-sans)] text-[0.72rem] uppercase tracking-[0.2em] text-[#ECE5D5]/70">
                por mes · unidad 2/2 de {usd(FEATURED_1_4.price!)}
              </span>
            </p>
            <p className="font-[family-name:var(--mp-serif)] text-4xl tabular-nums text-[#C7A869] sm:text-5xl">
              {usd(monthlyLeaseBack(FEATURED_1_4.price!) * 24, 2)}
              <span className="mt-1 block font-[family-name:var(--mp-sans)] text-[0.72rem] uppercase tracking-[0.2em] text-[#ECE5D5]/70">
                garantizados · 24 meses
              </span>
            </p>
          </div>
          <ul className="mt-10 space-y-4 text-[#ECE5D5]/90">
            {[
              <>El desarrollador <strong className="font-semibold text-white">garantiza la renta por 24 meses</strong> desde el closing: cobras sin tener que buscar inquilino.</>,
              <>Al terminar los dos años, <strong className="font-semibold text-white">el inquilino se queda contigo</strong> con contrato anual de 12 meses.</>,
              <>Las <strong className="font-semibold text-white">Torres 1–4 se pueden cerrar de inmediato</strong>, apenas estés listo — renta desde el primer día.</>,
              <>La garantía equivale al <strong className="font-semibold text-white">7% anual sobre el precio de compra</strong> de la unidad.</>,
            ].map((li, i) => (
              <li key={i} className="flex gap-4">
                <span aria-hidden className="mt-[0.45rem] h-px w-5 shrink-0 bg-[#C7A869]" />
                <span>{li}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- EL PROYECTO ---------- */}
      <section className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
        <Eyebrow>El proyecto</Eyebrow>
        <Rule />
        <h2 className="font-[family-name:var(--mp-serif)] text-4xl font-medium leading-[1.05] sm:text-5xl">La nueva generación</h2>
        <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-[#17160F]/85">
          Ocho torres distribuidas en 43 acres en uno de los corredores más codiciados de Orlando — a una milla
          de The Mall at Millenia y a dos de Universal Epic Universe. 960 unidades con amenities de última
          generación y 25,000 pies cuadrados de espacio comercial.
        </p>
        <dl className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-5">
          {[
            ["960", "unidades residenciales"],
            ["8", "torres"],
            ["43", "acres"],
            ["25,000", "sq ft comerciales"],
            ["1.2M", "sq ft construidos"],
          ].map(([n, l]) => (
            <div key={l} className="border-t border-[#E1DACA] pt-4">
              <dt className="font-[family-name:var(--mp-serif)] text-3xl tabular-nums text-[#17160F]">{n}</dt>
              <dd className="mt-1 text-sm text-[#7C776A]">{l}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---------- PRECIOS ---------- */}
      <section className="border-t border-[#E1DACA] bg-[#FBF9F3]/60">
        <div className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
          <Eyebrow>Precios</Eyebrow>
          <Rule />
          <h2 className="font-[family-name:var(--mp-serif)] text-4xl font-medium leading-[1.05] sm:text-5xl">Lista de precios por torre</h2>
          <PriceTable caption="Torres I, II, III y IV — entrega inmediata" units={TOWERS_1_4} />
          <PriceTable caption="Torres V, VI, VII y VIII — punto de entrada más bajo, entrega fin de 2027" units={TOWERS_5_8} />
          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-2 rounded-lg border border-[#E1DACA] bg-[#FBF9F3] px-5 py-4 text-sm">
            <span className="text-[0.68rem] uppercase tracking-[0.2em] text-[#7C776A]">HOA mensual</span>
            <span className="tabular-nums"><strong className="font-medium">A</strong> {usd(187.13, 2)}</span>
            <span className="tabular-nums"><strong className="font-medium">B</strong> {usd(252.99, 2)}</span>
            <span className="tabular-nums"><strong className="font-medium">C</strong> {usd(281.88, 2)}</span>
          </div>
          <p className="mt-4 max-w-[70ch] text-sm leading-relaxed text-[#7C776A]">
            La renta garantizada que aparece en cada fila es el 7% anual del precio de esa unidad, dividido en
            doce meses. Tamaños aproximados: A ≈ 750 sq ft · B ≈ 1,023 sq ft · C ≈ 1,215 sq ft (incluye balcón).
          </p>
        </div>
      </section>

      {/* ---------- PLAN DE PAGOS ---------- */}
      <section className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
        <Eyebrow>Estructura de pago · Torres 5–8</Eyebrow>
        <Rule />
        <h2 className="font-[family-name:var(--mp-serif)] text-4xl font-medium leading-[1.05] sm:text-5xl">50% en obra, 50% al closing</h2>
        <ol className="mt-10 space-y-px">
          {PAYMENT_PLAN.map(s => (
            <li key={s.when} className="flex flex-wrap items-baseline gap-x-5 gap-y-1 border-b border-[#E1DACA] py-4">
              <span className="w-14 font-[family-name:var(--mp-serif)] text-2xl tabular-nums text-[#A6823B]">{s.pct}%</span>
              <span className="flex-1 min-w-[12rem] text-[#17160F]">{s.when}</span>
              <span className="tabular-nums font-medium text-[#17160F]">{usd((FEATURED_5_8.price! * s.pct) / 100, 2)}</span>
            </li>
          ))}
        </ol>
        <p className="mt-5 max-w-[70ch] text-sm leading-relaxed text-[#7C776A]">
          Montos sobre la unidad 2/2 (tipo B) de las Torres 5–8, {usd(FEATURED_5_8.price!)}. Se desembolsa{" "}
          <strong className="font-medium text-[#17160F]">{usd(FEATURED_5_8.price! * 0.5, 2)}</strong> durante la obra
          y el resto al closing. Las Torres 1–4 están listas: se cierra de inmediato.
        </p>
      </section>

      {/* ---------- NÚMEROS ---------- */}
      <section className="border-t border-[#E1DACA] bg-[#FBF9F3]/60">
        <div className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
          <Eyebrow>Números de inversión · unidad 2/2 (tipo B)</Eyebrow>
          <Rule />
          <h2 className="font-[family-name:var(--mp-serif)] text-4xl font-medium leading-[1.05] sm:text-5xl">
            Rendimiento sobre la renta garantizada
          </h2>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {[
              { label: "Torres 1–4 · cierra ya", unit: FEATURED_1_4, net: NET_1_4, feature: true, avail: "Entrega inmediata" },
              { label: "Torres 5–8 · entrada más baja", unit: FEATURED_5_8, net: NET_5_8, feature: false, avail: "Closing fin de 2027" },
            ].map(c => (
              <article
                key={c.label}
                className={`rounded-lg border p-6 ${c.feature ? "border-[#A6823B]/40 bg-[#17130E] text-[#ECE5D5]" : "border-[#E1DACA] bg-[#FBF9F3]"}`}
              >
                <p className={`text-[0.68rem] uppercase tracking-[0.2em] ${c.feature ? "text-[#C7A869]" : "text-[#7C776A]"}`}>{c.label}</p>
                <p className={`mt-3 font-[family-name:var(--mp-serif)] text-4xl tabular-nums ${c.feature ? "text-white" : "text-[#17160F]"}`}>
                  {usd(c.unit.price!)}
                </p>
                <p className="mt-2 font-[family-name:var(--mp-serif)] text-2xl tabular-nums text-[#A6823B]">
                  7.00%<span className="ml-2 font-[family-name:var(--mp-sans)] text-xs uppercase tracking-[0.18em]">bruto garantizado</span>
                </p>
                <dl className={`mt-6 space-y-2 text-sm ${c.feature ? "text-[#ECE5D5]/85" : "text-[#17160F]/85"}`}>
                  {[
                    ["Renta garantizada / mes", usd(monthlyLeaseBack(c.unit.price!), 2)],
                    ["Renta anual", usd(c.net.gross, 2)],
                    ["Total 24 meses garantizados", usd(monthlyLeaseBack(c.unit.price!) * 24, 2)],
                    ["− HOA anual", `−${usd(c.net.hoa, 2)}`],
                    ["− Impuesto predial (est.)", `−${usd(c.net.tax, 0)}`],
                    ["− Seguro (est.)", `−${usd(c.net.insurance, 0)}`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 border-b border-current/10 pb-2">
                      <dt>{k}</dt>
                      <dd className="tabular-nums font-medium">{v}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between gap-4 pt-1">
                    <dt className="font-medium">Ingreso neto estimado (NOI)</dt>
                    <dd className={`tabular-nums font-semibold ${c.feature ? "text-[#C7A869]" : "text-[#A6823B]"}`}>
                      {usd(c.net.noi, 0)} · {c.net.netYield.toFixed(2)}%
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 pt-2 text-xs uppercase tracking-[0.16em] opacity-70">
                    <dt>Disponibilidad</dt>
                    <dd>{c.avail}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>

          <p className="mt-7 max-w-[72ch] text-sm leading-relaxed text-[#7C776A]">
            Precio, HOA y renta garantizada provienen del desarrollador.{" "}
            <strong className="font-medium text-[#17160F]">
              El impuesto predial ({(TAX_RATE_EST * 100).toFixed(1)}% del precio) y el seguro ({usd(INSURANCE_EST)}/año) son
              estimados
            </strong>{" "}
            y se confirman con la cifra real de Orange County y una cotización de seguro antes de cerrar. El
            rendimiento neto no incluye financiamiento, gastos de cierre ni administración durante el período
            garantizado.
          </p>
        </div>
      </section>

      {/* ---------- GALERÍA ---------- */}
      <section className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
        <Eyebrow>Galería</Eyebrow>
        <Rule />
        <h2 className="font-[family-name:var(--mp-serif)] text-4xl font-medium leading-[1.05] sm:text-5xl">El proyecto en imágenes</h2>
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["pool.jpg", "Piscina estilo resort de Millenia Park"],
            ["gallery-1.jpg", "Vista de las torres residenciales de Millenia Park"],
            ["gallery-2.jpg", "Áreas comunes de Millenia Park, Orlando"],
            ["gallery-3.jpg", "Entorno y paisajismo de Millenia Park"],
          ].map(([file, alt]) => (
            <img
              key={file}
              src={`${IMG}/${file}`}
              alt={alt}
              loading="lazy"
              className="aspect-[3/4] w-full rounded-lg object-cover"
            />
          ))}
        </div>
        <figure className="mx-auto mt-10 max-w-md">
          <img
            src={`${IMG}/flyer.jpg`}
            alt="Flyer oficial de Millenia Park: programa lease-back 7% con dos años de renta garantizada"
            loading="lazy"
            className="w-full rounded-lg border border-[#E1DACA]"
          />
          <figcaption className="mt-3 text-center text-sm text-[#7C776A]">Flyer oficial del desarrollador</figcaption>
        </figure>
      </section>

      {/* ---------- AMENITIES ---------- */}
      <section className="border-t border-[#E1DACA] bg-[#FBF9F3]/60">
        <div className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
          <Eyebrow>Amenities e interiores</Eyebrow>
          <Rule />
          <h2 className="font-[family-name:var(--mp-serif)] text-4xl font-medium leading-[1.05] sm:text-5xl">Comunidad estilo resort</h2>
          <div className="mt-10 grid gap-10 sm:grid-cols-2">
            {[
              { h: "Amenities y lifestyle", items: AMENITIES },
              { h: "Interiores y equipamiento", items: INTERIORS },
            ].map(col => (
              <div key={col.h}>
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#17160F]">{col.h}</h3>
                <ul className="mt-5 space-y-3 text-[#17160F]/85">
                  {col.items.map(it => (
                    <li key={it} className="flex gap-3">
                      <span aria-hidden className="mt-[0.5rem] h-1.5 w-1.5 shrink-0 rotate-45 bg-[#A6823B]" />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- UBICACIÓN ---------- */}
      <section className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
        <Eyebrow>Ubicación</Eyebrow>
        <Rule />
        <h2 className="font-[family-name:var(--mp-serif)] text-4xl font-medium leading-[1.05] sm:text-5xl">En el corredor Millenia</h2>
        <p className="mt-6 max-w-[60ch] text-[#17160F]/85">West Oak Ridge Road, Orlando, FL 32839 — con acceso directo a la I-4.</p>
        <div className="mt-10 grid gap-10 sm:grid-cols-3">
          {POIS.map(g => (
            <div key={g.group}>
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#17160F]">{g.group}</h3>
              <dl className="mt-5 space-y-3 text-sm">
                {g.items.map(([name, dist]) => (
                  <div key={name} className="flex justify-between gap-3 border-b border-[#E1DACA] pb-2">
                    <dt className="text-[#17160F]/85">{name}</dt>
                    <dd className="shrink-0 tabular-nums text-[#7C776A]">{dist}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- TESIS ---------- */}
      <section className="bg-[#17130E] text-[#ECE5D5]">
        <div className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
          <Eyebrow onDark>Por qué Orlando</Eyebrow>
          <Rule onDark />
          <h2 className="font-[family-name:var(--mp-serif)] text-4xl font-medium leading-[1.05] text-white sm:text-5xl">Tesis de inversión</h2>
          <ul className="mt-10 space-y-5 text-[#ECE5D5]/90">
            {[
              <><strong className="font-semibold text-white">Ocupación de alquiler por encima del 95%</strong> — entre las mejores del sureste de Estados Unidos.</>,
              <><strong className="font-semibold text-white">Primer lugar en crecimiento de empleo</strong> del país durante cinco años consecutivos, y sexta ciudad elegida para radicarse por motivos laborales.</>,
              <>Mega-inversión de <strong className="font-semibold text-white">$4.7 mil millones</strong> en el aeropuerto — el décimo más activo de Estados Unidos — más Brightline, SunRail e Hyperloop.</>,
              <><strong className="font-semibold text-white">Lake Nona «Medical City»</strong>, Amazon, Lockheed Martin y la UCF, con más de 69,000 estudiantes, sostienen la demanda de alquiler.</>,
            ].map((li, i) => (
              <li key={i} className="flex gap-4">
                <span aria-hidden className="mt-[0.5rem] h-1.5 w-1.5 shrink-0 rotate-45 bg-[#C7A869]" />
                <span>{li}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
        <Eyebrow>Preguntas frecuentes</Eyebrow>
        <Rule />
        <h2 className="font-[family-name:var(--mp-serif)] text-4xl font-medium leading-[1.05] sm:text-5xl">Lo que más preguntan</h2>
        <div className="mt-10 divide-y divide-[#E1DACA] border-y border-[#E1DACA]">
          {FAQS.map(f => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-left font-medium text-[#17160F] marker:content-none">
                <span>{f.q}</span>
                <span aria-hidden className="mt-1 shrink-0 text-[#A6823B] transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 max-w-[68ch] leading-relaxed text-[#17160F]/80">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ---------- CONTACTO ---------- */}
      <section className="border-t border-[#E1DACA] bg-[#FBF9F3]">
        <div className="mx-auto max-w-5xl px-5 py-16 text-center sm:py-20">
          <Eyebrow>Contacto</Eyebrow>
          <div className="mx-auto my-5 h-px w-12 bg-[#A6823B]" />
          <h2 className="font-[family-name:var(--mp-serif)] text-4xl font-medium sm:text-5xl">Catherine Gomez</h2>
          <p className="mt-2 text-sm uppercase tracking-[0.2em] text-[#7C776A]">Realtor · Miami &amp; Orlando</p>
          <p className="mt-6 font-[family-name:var(--mp-serif)] text-3xl tabular-nums">
            <a href={`tel:${PHONE_E164}`} className="text-[#17160F] hover:text-[#A6823B]">{PHONE_DISPLAY}</a>
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href={BOOK_URL} className="rounded-lg bg-[#17130E] px-7 py-4 font-medium text-[#ECE5D5] hover:bg-[#2a241b]">
              Agendar una llamada
            </a>
            <a href={WA_URL} className="rounded-lg bg-[#25D366] px-7 py-4 font-medium text-white hover:brightness-95">
              Escribir por WhatsApp
            </a>
            <a
              href="mailto:info@catherinegomezrealtor.com?subject=Millenia%20Park%20Orlando"
              className="rounded-lg border border-[#A6823B] px-7 py-4 font-medium text-[#A6823B] hover:bg-[#A6823B]/5"
            >
              Enviar un correo
            </a>
          </div>
        </div>
      </section>

      <footer className="bg-[#17130E] text-[#ECE5D5]/60">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-5 py-10 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>Millenia Park · Pre-construcción · Orlando, FL 32839</p>
          <p className="max-w-[46ch]">
            Precios, HOA y renta garantizada: desarrollador. Impuesto y seguro: estimados. Sujeto a cambios sin
            previo aviso. No constituye asesoría financiera ni legal.
          </p>
        </div>
      </footer>
    </main>
  )
}
