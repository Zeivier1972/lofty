import type { Metadata } from "next"
import { Cormorant_Garamond, Jost } from "next/font/google"
import { usd, Eyebrow, Rule, H2, GoldList, FaqList, ContactBlock } from "../_ui"

const serif = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--mp-serif" })
const sans = Jost({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--mp-sans" })

const BASE = "https://www.catherinegomezrealtor.com"
const PAGE_URL = `${BASE}/inversion/gz-tower`
const OG_IMAGE = `${BASE}/inversion/gz-tower/og.jpg`
const IMG = "/inversion/gz-tower"

const PHONE_DISPLAY = "305.283.0872"
const PHONE_E164 = "+13052830872"
const WA_URL = `https://wa.me/13052830872?text=${encodeURIComponent("Hola Catherine, quiero información sobre GZ Tower en Orlando.")}`
const BOOK_URL = `${BASE}/book`

const TITLE = "GZ Tower Orlando — Hotel-residencias amuebladas a 1 milla de Universal | Catherine Gomez"
const DESCRIPTION =
  "GZ Tower, Orlando: 357 residencias amuebladas tipo hotel a una milla de Universal Studios, desde $219,900. Unidades lockout de dos llaves, programa de administración con distribución en OTAs, plan de pagos 20/10/10/10/50 e inventario disponible con precio por pie cuadrado."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "GZ Tower Orlando",
    "hotel residencias Orlando",
    "condo hotel Orlando inversión",
    "invertir cerca de Universal Orlando",
    "renta corta Orlando Airbnb",
    "unidades lockout Orlando",
    "pre-construcción Orlando para extranjeros",
    "comprar condo hotel Florida",
    "Epic Universe inversión inmobiliaria",
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: PAGE_URL,
    type: "website",
    siteName: "Catherine Gomez Realtor",
    locale: "es_US",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "GZ Tower, Orlando — hotel-residencias de inversión a una milla de Universal" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [OG_IMAGE] },
}

/* ------------------------------------------------------------------ data ---
 * Inventory and prices come from the developer's price list dated 08/26; the
 * payment schedule from the Deposit Schedule dated 02/2026. Unlike Millenia
 * Park there is NO guaranteed rent here — income depends on short-term rental
 * performance — so this page shows price per square foot and a break-even
 * table rather than a projected return. Nothing on it is a revenue forecast.
 */
type Unit = { unit: string; line: string; type: string; mix: "Studio" | "1 Rec / 1 Baño"; sqft: number; price: number; lockWith?: string }

const INVENTORY: Unit[] = [
  { unit: "711 D-2", line: "11", type: "D-2", mix: "Studio", sqft: 276, price: 219900 },
  { unit: "911 D-2", line: "11", type: "D-2", mix: "Studio", sqft: 276, price: 229000 },
  { unit: "706 A", line: "6", type: "A", mix: "Studio", sqft: 299, price: 231900 },
  { unit: "1210 D-3", line: "10", type: "D-3", mix: "Studio", sqft: 267, price: 237000, lockWith: "1210 C-3" },
  { unit: "1106 A", line: "6", type: "A", mix: "Studio", sqft: 299, price: 245000, lockWith: "1106 B" },
  { unit: "1507 A", line: "7", type: "A", mix: "Studio", sqft: 299, price: 249000 },
  { unit: "812 A", line: "12", type: "A", mix: "Studio", sqft: 299, price: 250000, lockWith: "812 B" },
  { unit: "701 A", line: "1", type: "A", mix: "Studio", sqft: 299, price: 251000, lockWith: "701 B" },
  { unit: "1501 A", line: "1", type: "A", mix: "Studio", sqft: 299, price: 275000 },
  { unit: "1503 A", line: "3", type: "A", mix: "Studio", sqft: 299, price: 276000, lockWith: "1503 B" },
  { unit: "1505 A", line: "5", type: "A", mix: "Studio", sqft: 299, price: 277000, lockWith: "1505 B" },
  { unit: "1009 B", line: "9", type: "B", mix: "1 Rec / 1 Baño", sqft: 448, price: 339000 },
  { unit: "1509 B", line: "9", type: "B", mix: "1 Rec / 1 Baño", sqft: 448, price: 347000 },
  { unit: "710 C-3", line: "10", type: "C-3", mix: "1 Rec / 1 Baño", sqft: 462, price: 349900 },
  { unit: "711 C-2", line: "11", type: "C-2", mix: "1 Rec / 1 Baño", sqft: 462, price: 352900 },
  { unit: "701 B", line: "1", type: "B", mix: "1 Rec / 1 Baño", sqft: 453, price: 353000, lockWith: "701 A" },
  { unit: "1210 C-3", line: "10", type: "C-3", mix: "1 Rec / 1 Baño", sqft: 462, price: 367000, lockWith: "1210 D-3" },
  { unit: "812 B", line: "12", type: "B", mix: "1 Rec / 1 Baño", sqft: 453, price: 369000, lockWith: "812 A" },
  { unit: "713 E", line: "13", type: "E", mix: "Studio", sqft: 490, price: 375900 },
  { unit: "813 E", line: "13", type: "E", mix: "Studio", sqft: 490, price: 376000 },
  { unit: "1503 B", line: "3", type: "B", mix: "1 Rec / 1 Baño", sqft: 453, price: 385000, lockWith: "1503 A" },
  { unit: "1106 B", line: "6", type: "B", mix: "1 Rec / 1 Baño", sqft: 461, price: 399000, lockWith: "1106 A" },
  { unit: "1505 B", line: "5", type: "B", mix: "1 Rec / 1 Baño", sqft: 461, price: 422000, lockWith: "1505 A" },
]

const PRICE_MIN = Math.min(...INVENTORY.map(u => u.price))
const PRICE_MAX = Math.max(...INVENTORY.map(u => u.price))
const ppsf = (u: Unit) => u.price / u.sqft

/** Lockout pairs, each listed once, cheapest first. */
const LOCKOUTS = (() => {
  const seen = new Set<string>()
  const out: { a: Unit; b: Unit; sqft: number; total: number }[] = []
  for (const u of INVENTORY) {
    if (!u.lockWith || seen.has(u.unit)) continue
    const partner = INVENTORY.find(x => x.unit === u.lockWith)
    if (!partner) continue
    seen.add(u.unit)
    seen.add(partner.unit)
    const [a, b] = u.mix === "Studio" ? [u, partner] : [partner, u]
    out.push({ a, b, sqft: a.sqft + b.sqft, total: a.price + b.price })
  }
  return out.sort((x, y) => x.total - y.total)
})()

const PAYMENT_PLAN = [
  { pct: 20, when: "Al firmar el contrato" },
  { pct: 10, when: "90 días después del contrato" },
  { pct: 10, when: "6 meses después del contrato" },
  { pct: 10, when: "Al top-off (terminar la estructura)" },
  { pct: 50, when: "Al closing" },
]

/** Orlando hotel occupancy, June 2025, from the developer's own presentation. */
const OCCUPANCY = 0.735
const NIGHTS = Math.round(365 * OCCUPANCY)
const YIELD_STEPS = [0.06, 0.08, 0.1, 0.12]
const BREAKEVEN_UNITS = [
  INVENTORY.find(u => u.unit === "711 D-2")!,
  INVENTORY.find(u => u.unit === "706 A")!,
  INVENTORY.find(u => u.unit === "1009 B")!,
  INVENTORY.find(u => u.unit === "713 E")!,
]
const requiredAdr = (price: number, targetYield: number) => (price * targetYield) / NIGHTS

const POIS = [
  { group: "Universal y parques", items: [["Hard Rock Hotel at Universal", "1.1 millas"], ["Dezerland Park Orlando", "1.5 millas"], ["Universal City Walk", "1.7 millas"], ["Universal's Volcano Bay", "1.7 millas"], ["Magic Kingdom", "6.9 millas"], ["Universal Epic Universe", "7.6 millas"], ["SeaWorld Orlando", "7.8 millas"], ["Walt Disney World Resort", "8.7 millas"]] },
  { group: "Retail y convenciones", items: [["The Mall at Millenia", "1.6 millas"], ["ICON Orlando 360°", "3.6 millas"], ["Orange County Convention Center", "4.7 millas"]] },
  { group: "Conectividad", items: [["Orlando International Airport", "15 millas"], ["Brightline Orlando Station", "17.7 millas"], ["Acceso a I-4 y Florida's Turnpike", "Directo"]] },
]

const MANAGEMENT = [
  "Property Management System: distribución y sincronización en múltiples OTAs, mensajería automatizada con el huésped, precios dinámicos, reservas y calendario centralizados, reportes de ocupación y RevPAR, y facturación.",
  "Recepción universal: acceso al edificio 24/7 con personal de front desk que recibe al huésped y controla la entrada.",
  "Alianzas estratégicas: el propietario elige entre operadores calificados, así que la administración se mantiene competitiva sin quedar atado a uno solo.",
]

const FAQS: { q: string; a: string }[] = [
  {
    q: "¿Qué es GZ Tower?",
    a: "Es una torre de 17 pisos con 357 residencias totalmente amuebladas y equipadas en el corazón turístico de Orlando, a una milla de Universal Studios. Funciona como hotel-residencia: se compra como propiedad y se puede operar como renta corta a través del programa de administración del edificio.",
  },
  {
    q: "¿GZ Tower garantiza la renta como otros proyectos?",
    a: "No. A diferencia de un programa de lease-back, aquí no hay renta garantizada: el ingreso depende de cómo se desempeñe la unidad en renta corta. Por eso esta página muestra el precio por pie cuadrado y cuánto tendría que cobrarse por noche para alcanzar distintos rendimientos, en lugar de prometer un retorno.",
  },
  {
    q: "¿Qué es una unidad lockout?",
    a: "Son dos residencias contiguas que se compran juntas y funcionan como una sola unidad con dos llaves: se pueden rentar por separado a dos huéspedes, o unidas como una residencia más grande para familias. Da flexibilidad para ajustar el inventario a la temporada.",
  },
  {
    q: "¿Cuál es el plan de pagos?",
    a: "20% al firmar el contrato, 10% a los 90 días, 10% a los 6 meses, 10% al top-off (cuando se termina la estructura) y el 50% restante al closing. Se desembolsa la mitad durante la obra.",
  },
  {
    q: "¿Desde cuánto puedo entrar?",
    a: `El inventario disponible va desde ${usd(PRICE_MIN)} por un studio de 276 pies cuadrados hasta ${usd(PRICE_MAX)} por una unidad de una recámara de 461 pies cuadrados. El primer desembolso es el 20% al contrato.`,
  },
  {
    q: "¿Las residencias vienen amuebladas?",
    a: "Sí. Las residencias se entregan totalmente amuebladas, decoradas y equipadas, con cocina completa y diseño de concepto abierto, listas para recibir huéspedes.",
  },
  {
    q: "¿Qué amenidades tiene el edificio?",
    a: "Spa con salas de masaje, gimnasio para entrenamiento funcional, cardio, fuerza, yoga y meditación, áreas de coworking, lounge, restaurante y recepción con servicio 24/7, además de vistas panorámicas de 360 grados de la ciudad.",
  },
  {
    q: "¿Puede comprar un extranjero sin residencia en Estados Unidos?",
    a: "Sí. No se necesita ser residente ni ciudadano estadounidense. Se puede comprar a nombre propio o mediante una LLC. El financiamiento para extranjeros existe, aunque en producto tipo condo-hotel las condiciones son más estrictas que en un condominio residencial — conviene revisarlo caso por caso antes de firmar.",
  },
]

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "RealEstateAgent",
      "@id": `${BASE}#agent`,
      name: "Catherine Gomez Realtor",
      image: OG_IMAGE,
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
      name: "GZ Tower",
      description: DESCRIPTION,
      url: PAGE_URL,
      image: [`${BASE}${IMG}/hero.jpg`, `${BASE}${IMG}/lobby.jpg`, `${BASE}${IMG}/residencia.jpg`],
      numberOfAccommodationUnits: 357,
      address: { "@type": "PostalAddress", addressLocality: "Orlando", addressRegion: "FL", addressCountry: "US" },
      amenityFeature: ["Spa y salas de masaje", "Gimnasio", "Coworking", "Lounge", "Restaurante", "Recepción 24/7", "Vistas panorámicas 360°"].map(a => ({
        "@type": "LocationFeatureSpecification",
        name: a,
        value: true,
      })),
      broker: { "@id": `${BASE}#agent` },
    },
    {
      "@type": "ItemList",
      name: "Inventario disponible — GZ Tower",
      numberOfItems: INVENTORY.length,
      itemListElement: INVENTORY.map((u, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "Apartment",
          name: `GZ Tower ${u.unit} — ${u.mix}`,
          floorSize: { "@type": "QuantitativeValue", value: u.sqft, unitCode: "FTK" },
          offers: { "@type": "Offer", price: u.price, priceCurrency: "USD", availability: "https://schema.org/InStock", url: PAGE_URL },
        },
      })),
    },
    {
      "@type": "Product",
      name: "GZ Tower — hotel-residencias de inversión en Orlando",
      image: `${BASE}${IMG}/hero.jpg`,
      description: "Residencias amuebladas tipo hotel en Orlando, a una milla de Universal Studios, con programa de administración y unidades lockout de dos llaves.",
      brand: { "@type": "Brand", name: "GZ Tower" },
      offers: {
        "@type": "AggregateOffer",
        lowPrice: PRICE_MIN,
        highPrice: PRICE_MAX,
        priceCurrency: "USD",
        offerCount: INVENTORY.length,
        url: PAGE_URL,
      },
    },
    { "@type": "FAQPage", mainEntity: FAQS.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
  ],
}

export default function GzTowerPage() {
  return (
    <main className={`${serif.variable} ${sans.variable} bg-[#F3F0E8] font-[family-name:var(--mp-sans)] text-[#17160F]`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ---------- HERO ---------- */}
      <header className="relative flex min-h-[70vh] items-end overflow-hidden bg-[#17130E]">
        <img src={`${IMG}/hero.jpg`} alt="GZ Tower, Orlando — rendering de la torre de hotel-residencias con su terraza de piscina" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(12,10,7,0.22)_0%,rgba(12,10,7,0.30)_40%,rgba(12,10,7,0.72)_66%,rgba(12,10,7,0.93)_84%,rgba(12,10,7,0.97)_100%)]" />
        <div className="relative mx-auto w-full max-w-5xl px-5 pb-12 pt-28 sm:pb-16">
          <Eyebrow onDark>Oportunidad de inversión · Orlando</Eyebrow>
          <h1 className="mt-3 font-[family-name:var(--mp-serif)] text-5xl font-medium leading-[0.95] text-white sm:text-7xl lg:text-8xl">GZ&nbsp;Tower</h1>
          <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#ECE5D5] sm:text-base">
            <span>Orlando, Florida</span>
            <span className="text-[#C7A869]">·</span>
            <span>Hotel-residencias amuebladas</span>
            <span className="text-[#C7A869]">·</span>
            <span>A 1 milla de Universal</span>
          </p>
        </div>
      </header>

      {/* ---------- FACTS ---------- */}
      <section aria-label="Datos principales" className="border-y border-[#E1DACA] bg-[#FBF9F3]">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-px px-5 py-8 sm:grid-cols-4">
          {[
            { k: "Desde", v: usd(PRICE_MIN), small: "studio de 276 sq ft" },
            { k: "Residencias", v: "357", small: "amuebladas y equipadas" },
            { k: "Pisos", v: "17", small: "vistas 360°" },
            { k: "Universal Studios", v: "1 milla", small: "City Walk a 1.7" },
          ].map(f => (
            <div key={f.k} className="px-2">
              <p className="text-[0.68rem] uppercase tracking-[0.2em] text-[#7C776A]">{f.k}</p>
              <p className="mt-2 font-[family-name:var(--mp-serif)] text-2xl tabular-nums text-[#17160F] sm:text-3xl">
                {f.v}
                <span className="mt-1 block text-[0.7rem] tracking-wide text-[#7C776A]">{f.small}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- EL PROYECTO ---------- */}
      <section className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
        <Eyebrow>El proyecto</Eyebrow>
        <Rule />
        <H2>Lo mejor del hotel, con la autonomía de lo residencial</H2>
        <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-[#17160F]/85">
          GZ Tower es una colección de 357 residencias totalmente amuebladas y equipadas en el corazón turístico
          de Orlando, con acceso privilegiado a Universal Orlando Resort y vistas panorámicas de 360 grados.
          Está diseñada para rendir como un hotel, pero con la comodidad, flexibilidad y autonomía de una
          propiedad residencial.
        </p>
        <div className="mt-10 grid gap-10 sm:grid-cols-2">
          <GoldList
            items={[
              <>Residencias <strong className="font-semibold">amuebladas, decoradas y equipadas</strong>, con cocina completa y planta de concepto abierto.</>,
              <>Amenidades de hotel: <strong className="font-semibold">spa y salas de masaje</strong>, gimnasio, coworking, lounge, restaurante y recepción 24/7.</>,
              <>Unidades <strong className="font-semibold">lockout de dos llaves</strong> — se rentan separadas o unidas.</>,
              <>Desarrollador: <strong className="font-semibold">GZ Universal Developers LLC</strong>.</>,
            ]}
          />
          <div className="rounded-lg border border-[#E1DACA] bg-[#FBF9F3] p-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em]">El momento de Orlando</h3>
            <dl className="mt-5 space-y-3 text-sm">
              {[
                ["Metro de mayor crecimiento de EE. UU.", "#1 en empleo, población y PIB nominal"],
                ["Visitantes al año", "76 millones, +7.4% anual"],
                ["Ocupación hotelera (jun. 2025)", "73.5%, +1.5% interanual"],
                ["Recaudo de impuesto turístico", "+10.3% — el junio más alto registrado"],
                ["Orlando International Airport", "57M+ pasajeros, supera a Miami"],
              ].map(([k, v]) => (
                <div key={k} className="border-b border-[#E1DACA] pb-2">
                  <dt className="text-[#17160F]/85">{k}</dt>
                  <dd className="mt-0.5 font-medium text-[#A6823B]">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-[#7C776A]">Fuente: presentación del desarrollador y Orlando Economic Partnership.</p>
          </div>
        </div>
      </section>

      {/* ---------- INVENTARIO ---------- */}
      <section className="border-t border-[#E1DACA] bg-[#FBF9F3]/60">
        <div className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
          <Eyebrow>Inventario disponible</Eyebrow>
          <Rule />
          <H2>{INVENTORY.length} residencias, de {usd(PRICE_MIN)} a {usd(PRICE_MAX)}</H2>
          <div className="mt-8 overflow-x-auto rounded-lg border border-[#E1DACA] bg-[#FBF9F3]">
            <table className="w-full min-w-[620px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#E1DACA] text-[0.72rem] uppercase tracking-[0.18em] text-[#7C776A]">
                  <th scope="col" className="px-5 py-3 font-medium">Unidad</th>
                  <th scope="col" className="px-5 py-3 font-medium">Tipo</th>
                  <th scope="col" className="px-5 py-3 font-medium">Distribución</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Sq ft</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Precio</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">$/sq ft</th>
                </tr>
              </thead>
              <tbody>
                {INVENTORY.map(u => (
                  <tr key={u.unit} className="border-b border-[#E1DACA] last:border-0">
                    <td className="px-5 py-3 font-medium text-[#17160F]">
                      {u.unit}
                      {u.lockWith && <span className="ml-2 rounded bg-[#A6823B]/12 px-1.5 py-0.5 align-middle text-[0.6rem] uppercase tracking-[0.12em] text-[#A6823B]">lockout</span>}
                    </td>
                    <td className="px-5 py-3 text-[#7C776A]">{u.type}</td>
                    <td className="px-5 py-3 text-[#17160F]">{u.mix}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-[#7C776A]">{u.sqft}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-medium text-[#17160F]">{usd(u.price)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-[#A6823B]">{usd(ppsf(u))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 max-w-[72ch] text-sm leading-relaxed text-[#7C776A]">
            Lista de precios del desarrollador con fecha 08/26. El inventario y los precios están sujetos a
            disponibilidad y pueden cambiar sin previo aviso. El precio por pie cuadrado del inventario actual va
            de {usd(Math.min(...INVENTORY.map(ppsf)))} a {usd(Math.max(...INVENTORY.map(ppsf)))}, con un promedio
            de {usd(INVENTORY.reduce((s, u) => s + ppsf(u), 0) / INVENTORY.length)} — útil para comparar unidades entre sí.
          </p>
        </div>
      </section>

      {/* ---------- LOCKOUT ---------- */}
      <section className="bg-[#17130E] text-[#ECE5D5]">
        <div className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
          <Eyebrow onDark>El diferenciador</Eyebrow>
          <Rule onDark />
          <H2 onDark>La unidad lockout: dos llaves, una propiedad</H2>
          <p className="mt-6 max-w-[62ch] text-lg leading-relaxed text-[#ECE5D5]/85">
            Dos residencias contiguas que se compran juntas y se operan como una sola unidad con dos accesos
            independientes. Se rentan por separado a dos huéspedes distintos, o unidas como una residencia más
            grande para familias — el inventario se ajusta a la temporada en lugar de quedar fijo.
          </p>
          <div className="mt-10 grid gap-8 md:grid-cols-[1.1fr_1fr] md:items-start">
            <div className="overflow-x-auto rounded-lg border border-[#C7A869]/25">
              <table className="w-full min-w-[420px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#C7A869]/25 text-[0.68rem] uppercase tracking-[0.16em] text-[#C7A869]">
                    <th scope="col" className="px-4 py-3 font-medium">Par</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Sq ft</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">$/sq ft</th>
                  </tr>
                </thead>
                <tbody>
                  {LOCKOUTS.map(l => (
                    <tr key={l.a.unit} className="border-b border-[#C7A869]/15 last:border-0">
                      <td className="px-4 py-3">
                        {l.a.unit} <span className="text-[#C7A869]">+</span> {l.b.unit}
                        <span className="block text-xs text-[#ECE5D5]/55">studio + 1 recámara</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#ECE5D5]/70">{l.sqft}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-white">{usd(l.total)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#C7A869]">{usd(l.total / l.sqft)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <figure>
              <img src={`${IMG}/lockout.jpg`} alt="Planta de una unidad lockout de GZ Tower: studio y residencia de una recámara conectadas" loading="lazy" className="w-full rounded-lg" />
              <figcaption className="mt-3 text-sm text-[#ECE5D5]/55">Unidad tipo A + B — 752 sq ft en conjunto.</figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* ---------- PLAN DE PAGOS ---------- */}
      <section className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
        <Eyebrow>Estructura de pago</Eyebrow>
        <Rule />
        <H2>50% en obra, 50% al closing</H2>
        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#E1DACA] text-[0.72rem] uppercase tracking-[0.18em] text-[#7C776A]">
                <th scope="col" className="py-3 pr-4 font-medium">Hito</th>
                <th scope="col" className="py-3 pr-4 font-medium">%</th>
                <th scope="col" className="py-3 pr-4 text-right font-medium">Studio {usd(PRICE_MIN)}</th>
                <th scope="col" className="py-3 pr-4 text-right font-medium">1 rec {usd(339000)}</th>
                <th scope="col" className="py-3 text-right font-medium">Lockout {usd(LOCKOUTS[0].total)}</th>
              </tr>
            </thead>
            <tbody>
              {PAYMENT_PLAN.map(s => (
                <tr key={s.when} className="border-b border-[#E1DACA]">
                  <td className="py-4 pr-4 text-[#17160F]">{s.when}</td>
                  <td className="py-4 pr-4 font-[family-name:var(--mp-serif)] text-xl tabular-nums text-[#A6823B]">{s.pct}%</td>
                  <td className="py-4 pr-4 text-right tabular-nums">{usd((PRICE_MIN * s.pct) / 100)}</td>
                  <td className="py-4 pr-4 text-right tabular-nums">{usd((339000 * s.pct) / 100)}</td>
                  <td className="py-4 text-right tabular-nums">{usd((LOCKOUTS[0].total * s.pct) / 100)}</td>
                </tr>
              ))}
              <tr className="font-medium">
                <td className="py-4 pr-4">Desembolsado antes del closing</td>
                <td className="py-4 pr-4 font-[family-name:var(--mp-serif)] text-xl tabular-nums text-[#A6823B]">50%</td>
                <td className="py-4 pr-4 text-right tabular-nums">{usd(PRICE_MIN * 0.5)}</td>
                <td className="py-4 pr-4 text-right tabular-nums">{usd(339000 * 0.5)}</td>
                <td className="py-4 text-right tabular-nums">{usd(LOCKOUTS[0].total * 0.5)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-5 max-w-[70ch] text-sm leading-relaxed text-[#7C776A]">
          Según el Deposit Schedule del desarrollador con fecha 02/2026. Confirma las fechas exactas de cada hito
          en el contrato antes de firmar.
        </p>
      </section>

      {/* ---------- LOS NÚMEROS ---------- */}
      <section className="border-t border-[#E1DACA] bg-[#FBF9F3]/60">
        <div className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
          <Eyebrow>Los números</Eyebrow>
          <Rule />
          <H2>Qué tendría que cobrarse por noche</H2>
          <div className="mt-6 max-w-[68ch] space-y-4 text-[#17160F]/85">
            <p>
              GZ Tower <strong className="font-semibold">no ofrece renta garantizada</strong>. El ingreso depende de
              cómo se desempeñe la unidad en renta corta, así que en vez de prometer un retorno, aquí está el
              cálculo al revés: cuánto tendría que cobrarse por noche para alcanzar cada nivel de rendimiento
              bruto, usando la ocupación hotelera de Orlando que reporta el propio desarrollador — {(OCCUPANCY * 100).toFixed(1)}%,
              es decir {NIGHTS} noches al año.
            </p>
            <p className="text-sm text-[#7C776A]">
              Compara estas tarifas con lo que realmente se cobra hoy en la zona de Universal y tendrás una
              lectura honesta de si los números cierran.
            </p>
          </div>
          <div className="mt-8 overflow-x-auto rounded-lg border border-[#E1DACA] bg-[#FBF9F3]">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <caption className="px-5 pt-5 pb-3 text-left text-sm text-[#7C776A]">
                Tarifa por noche necesaria (ADR) para un rendimiento bruto dado, a {NIGHTS} noches ocupadas al año
              </caption>
              <thead>
                <tr className="border-y border-[#E1DACA] text-[0.72rem] uppercase tracking-[0.18em] text-[#7C776A]">
                  <th scope="col" className="px-5 py-3 font-medium">Unidad</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Precio</th>
                  {YIELD_STEPS.map(y => (
                    <th key={y} scope="col" className="px-5 py-3 text-right font-medium">{(y * 100).toFixed(0)}%</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {BREAKEVEN_UNITS.map(u => (
                  <tr key={u.unit} className="border-b border-[#E1DACA] last:border-0">
                    <td className="px-5 py-4">
                      <span className="font-medium text-[#17160F]">{u.unit}</span>
                      <span className="block text-xs text-[#7C776A]">{u.mix} · {u.sqft} sq ft</span>
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-[#17160F]">{usd(u.price)}</td>
                    {YIELD_STEPS.map(y => (
                      <td key={y} className="px-5 py-4 text-right tabular-nums text-[#A6823B]">{usd(requiredAdr(u.price, y))}</td>
                    ))}
                  </tr>
                ))}
                <tr className="bg-[#17130E]/[0.03]">
                  <td className="px-5 py-4">
                    <span className="font-medium text-[#17160F]">{LOCKOUTS[0].a.unit} + {LOCKOUTS[0].b.unit}</span>
                    <span className="block text-xs text-[#7C776A]">lockout · {LOCKOUTS[0].sqft} sq ft · dos llaves</span>
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums text-[#17160F]">{usd(LOCKOUTS[0].total)}</td>
                  {YIELD_STEPS.map(y => (
                    <td key={y} className="px-5 py-4 text-right tabular-nums text-[#A6823B]">{usd(requiredAdr(LOCKOUTS[0].total, y))}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-7 rounded-lg border border-[#A6823B]/30 bg-[#A6823B]/[0.05] p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#17160F]">Lo que estas cifras no incluyen</h3>
            <p className="mt-3 max-w-[72ch] text-sm leading-relaxed text-[#17160F]/80">
              La tarifa de arriba produce el <strong className="font-semibold">ingreso bruto</strong>. De ahí todavía
              salen las comisiones de las OTAs, el fee de administración, limpieza entre huéspedes, utilities, el
              HOA, el impuesto predial y el seguro. El desarrollador no publica el HOA ni una proyección de
              ingresos para este proyecto, así que no hay cifra neta confiable todavía — pídemela y la armamos
              con los números reales de la unidad que te interese antes de firmar nada.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- ADMINISTRACIÓN ---------- */}
      <section className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
        <Eyebrow>El programa de administración</Eyebrow>
        <Rule />
        <H2>Centralizado, simplificado y abierto</H2>
        <p className="mt-6 max-w-[62ch] text-lg leading-relaxed text-[#17160F]/85">
          El edificio ofrece una opción de administración para quien no quiera operar la unidad por su cuenta — y
          deja al propietario elegir el operador, en vez de amarrarlo a uno solo.
        </p>
        <div className="mt-10">
          <GoldList items={MANAGEMENT} />
        </div>
      </section>

      {/* ---------- GALERÍA ---------- */}
      <section className="border-t border-[#E1DACA] bg-[#FBF9F3]/60">
        <div className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
          <Eyebrow>Galería</Eyebrow>
          <Rule />
          <H2>El edificio por dentro</H2>
          <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              ["lobby.jpg", "Lobby y lounge de GZ Tower"],
              ["dining.jpg", "Restaurante del edificio"],
              ["lounge.jpg", "Área social y de juegos"],
              ["spa.jpg", "Spa y sala de masaje"],
              ["cowork.jpg", "Área de coworking con vista a la ciudad"],
              ["residencia.jpg", "Sala y cocina de una residencia amueblada"],
              ["dormitorio.jpg", "Recámara de una residencia de GZ Tower"],
              ["aerial.jpg", "Vista aérea del entorno de GZ Tower en Orlando"],
            ].map(([file, alt]) => (
              <img key={file} src={`${IMG}/${file}`} alt={alt} loading="lazy" className="aspect-[4/3] w-full rounded-lg object-cover" />
            ))}
          </div>
        </div>
      </section>

      {/* ---------- UBICACIÓN ---------- */}
      <section className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
        <Eyebrow>Ubicación</Eyebrow>
        <Rule />
        <H2>En el centro del motor turístico</H2>
        <p className="mt-6 max-w-[60ch] text-[#17160F]/85">
          Orlando recibe más de 76 millones de visitantes al año. GZ Tower está a una milla de Universal Studios,
          con acceso directo a la I-4 y a Florida&apos;s Turnpike.
        </p>
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

      {/* ---------- FAQ ---------- */}
      <section className="border-t border-[#E1DACA] bg-[#FBF9F3]/60">
        <div className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
          <Eyebrow>Preguntas frecuentes</Eyebrow>
          <Rule />
          <H2>Lo que más preguntan</H2>
          <div className="mt-10">
            <FaqList faqs={FAQS} />
          </div>
        </div>
      </section>

      <ContactBlock bookUrl={BOOK_URL} waUrl={WA_URL} phoneDisplay={PHONE_DISPLAY} phoneE164={PHONE_E164} subject="GZ Tower Orlando" />

      <footer className="bg-[#17130E] text-[#ECE5D5]/55">
        <div className="mx-auto max-w-5xl space-y-3 px-5 py-10 text-xs leading-relaxed">
          <p className="text-[#ECE5D5]/75">GZ Tower · Orlando, Florida · Desarrollado por GZ Universal Developers LLC</p>
          <p>
            Precios e inventario según la lista del desarrollador (08/26) y el Deposit Schedule (02/2026), sujetos
            a cambio sin previo aviso. Esta página no constituye asesoría financiera, legal ni fiscal, ni una
            proyección de ingresos. GZ Tower no ofrece renta garantizada.
          </p>
          <p>
            ORAL REPRESENTATIONS CANNOT BE RELIED UPON AS CORRECTLY STATING THE REPRESENTATIONS OF THE DEVELOPER.
            FOR CORRECT REPRESENTATIONS, MAKE REFERENCE TO THE DOCUMENTS REQUIRED BY SECTION 718.503, FLORIDA
            STATUTES, TO BE FURNISHED BY A DEVELOPER TO A BUYER OR LESSEE.
          </p>
        </div>
      </footer>
    </main>
  )
}
