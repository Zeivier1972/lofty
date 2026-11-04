export const dynamic = "force-dynamic"

import { readdirSync } from "fs"
import { join } from "path"
import type { Metadata } from "next"
import { jostDisplay } from "@/app/fonts"
import { prisma } from "@/lib/prisma"
import LeadForm from "./lead-form"
import BookingForm from "./booking-form"
import DepositCalculator, { type DepositStage } from "./deposit-calculator"
import { UNITS, UNITS_AS_OF, type DomusUnit } from "./units"

/**
 * Domus Brickell Center — investment landing page (Spanish, Latin American
 * investors). Same structure as /parkside.
 *
 * Content rule: only what the developer's material says — the availability
 * list of 2026-10-19 (every unit and price shown), the Spanish fact sheet, the
 * rack brochure and the deposit schedule the client confirmed applies here.
 * Address confirmed by the client: 1034 SW 2nd Avenue. Travel times are the
 * brochure's (the separate "Domus FLATS" POI map belongs to another building).
 * No ROI, occupancy or HOA figures — none were provided.
 */

const display = jostDisplay

/** Domus palette: charcoal façade, warm white, the gold of the lit tower at night. */
const INK = "#17191C"
const CHARCOAL = "#26292D"
const PAPER = "#F5F3EF"
const STONE = "#EAE6DF"
const GOLD = "#A9844C"
const GOLD_LIGHT = "#E2CB9C"

const sans = "var(--font-display), 'Helvetica Neue', Arial, sans-serif"
const EYEBROW = "text-[11px] font-medium uppercase tracking-[0.34em]"
const H2 = "mt-6 text-[2rem] font-light leading-[1.15] sm:text-[2.8rem]"

const BASE = "https://www.catherinegomezrealtor.com"
const PAGE_URL = `${BASE}/domus`
const IMG_DIR = "/domus"
const HERO = `${IMG_DIR}/aerea-bahia.jpg`
const ADDRESS = "1034 SW 2nd Avenue, Miami, FL 33130"

const fmt = (n: number) => `$${n.toLocaleString("en-US")}`
const fromPrice = (t: DomusUnit["type"]) => Math.min(...UNITS.filter(u => u.type === t).map(u => u.price))
const STUDIO_FROM = fromPrice("Estudio")
const ONE_FROM = fromPrice("1 habitación")
const TWO_FROM = fromPrice("2 habitaciones")

const TITLE = `Domus Brickell Center — FLATS amueblados en Brickell desde ${fmt(STUDIO_FROM)} | Catherine Gomez`
const DESCRIPTION =
  `Domus Brickell Center: torre de 35 pisos con 579 FLATS totalmente amueblados en Brickell, Miami (${ADDRESS}). Estudios desde ${fmt(STUDIO_FROM)}, 1 habitación desde ${fmt(ONE_FROM)} y 2 habitaciones desde ${fmt(TWO_FROM)} USD, con servicio tipo hotel, app Domus y portal de alquiler para propietarios. Precios, unidades disponibles, plan de depósitos y asesoría en español con Catherine Gomez.`

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "Domus Brickell Center",
    "Domus Brickell",
    "Domus FLATS Miami",
    "apartamentos amueblados en Brickell",
    "preconstrucción Brickell",
    "invertir en Miami desde Latinoamérica",
    "condo hotel Miami",
    "estudios en Brickell precio",
    "North Development Miami",
    "comprar apartamento en Miami siendo extranjero",
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: PAGE_URL,
    type: "website",
    siteName: "Catherine Gomez Realtor",
    locale: "es_LA",
    // opengraph-image.tsx / twitter-image.tsx generate the 1200x630 card.
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
}

/** Official renderings in public/domus/. New files join the gallery on their own. */
function renderings(): string[] {
  try {
    return readdirSync(join(process.cwd(), "public", "domus"))
      .filter(f => /\.(jpe?g|png|webp|avif)$/i.test(f))
      .sort()
      .map(f => `${IMG_DIR}/${f}`)
  } catch {
    return []
  }
}

const ALT: Record<string, string> = {
  "aerea-bahia.jpg": "Corona de la torre Domus Brickell Center con el skyline de Brickell y la bahía de Biscayne al fondo",
  "torre-dia.jpg": "Torre de 35 pisos de Domus Brickell Center de día, con balcones en todos los FLATS y azotea ajardinada",
  "calle-lobby.jpg": "Planta baja de Domus Brickell Center a nivel de calle, con restaurante, terraza y árboles en la acera",
  "azotea-noche.jpg": "Azotea iluminada de Domus Brickell Center al anochecer, con palmeras y balcones de vidrio",
  "skyline-noche.jpg": "Domus Brickell Center iluminado de noche entre los rascacielos de Brickell",
  "piscina-azotea.jpg": "Piscina en la azotea de Domus Brickell Center con palmeras y vista a la bahía de Biscayne",
  "piscina-aerea.jpg": "Vista aérea de la piscina y los camastros de la azotea de Domus Brickell Center",
  "flat-sala.jpg": "Sala de un FLAT amueblado de Domus con mueble de TV, sofá y ventanal a Brickell",
  "flat-cocina-sala.jpg": "Cocina equipada y sala de un FLAT de Domus Brickell Center con balcón y vista a la ciudad",
  "flat-habitacion.jpg": "Habitación de un FLAT de Domus con ventanales de piso a techo y vista a Brickell",
  "brickell-city-centre.jpg": "Brickell City Centre, centro de compras a pocos minutos de Domus Brickell Center",
  "metrorail-brickell.jpg": "Estación de Metrorail en Brickell, a 2 minutos de Domus Brickell Center",
  "brickell-aerea-noche.jpg": "Vista aérea nocturna de Brickell y la bahía de Biscayne donde se ubica Domus Brickell Center",
}
const altFor = (src: string) => ALT[src.split("/").pop() || ""] || "Render oficial de Domus Brickell Center en Brickell, Miami"

const FACTS: [string, string][] = [
  ["35", "pisos"],
  ["579", "FLATS amueblados"],
  ["24/7", "recepción y valet"],
  ["100+", "plataformas de reservas"],
]

const UNIT_TYPES: { type: DomusUnit["type"]; body: string }[] = [
  { type: "Estudio", body: "Cama King o Queen, cocina equipada y balcón. Capacidad de 2 a 4 huéspedes según el modelo." },
  { type: "1 habitación", body: "Suite de una habitación con sala separada, cocina y lavadora/secadora. Capacidad para 4 huéspedes." },
  { type: "2 habitaciones", body: "Para familias o grupos: hasta 6 huéspedes, con opciones de balcón envolvente." },
]

const FLAT_FEATURES = [
  "Se entregan terminados y amueblados",
  "Pisos de madera en todas las áreas",
  "Balcón privado",
  "Techos de más de 9 pies",
  "Cerradura inteligente sin llave",
  "Electrodomésticos Bosch",
  "Encimeras de piedra",
  "Lavadora y secadora",
  "Agua filtrada con tecnología UV",
]

const AMENITIES = [
  "Piscina en la azotea y terraza panorámica",
  "Bar en la azotea",
  "Cabañas con camas de día",
  "Jacuzzi",
  "Deck de yoga en la azotea",
  "Gimnasio interior y exterior",
  "Salas de tratamiento y baño de vapor",
  "Lounge del vestíbulo con restaurante y bar",
  "Lounge con jardín",
  "Amplio espacio de coworking",
  "Sala de conferencias",
  "Domus Bike Share y carga para autos eléctricos",
]

const SERVICES = [
  "Recepción las 24 horas",
  "Valet parking 24 horas (30 días gratis al año por 3 años para propietarios)",
  "Línea de atención al cliente 24 horas",
  "Gerente de control de calidad para limpieza y rotación",
  "Equipo de limpieza de hotelería, cuando lo necesite",
  "Portal de alquiler para propietarios",
]

const DEPOSITS: DepositStage[] = [
  { pct: 10, when: "Al firmar el contrato" },
  { pct: 10, when: "Al inicio de la construcción" },
  { pct: 5, when: "2 meses después del inicio de obra" },
  { pct: 5, when: "4 meses después del inicio de obra" },
  { pct: 5, when: "6 meses después del inicio de obra" },
  { pct: 65, when: "Al cierre" },
]

/** From the brochure ("Proximity"). */
const PROXIMITY: [string, string][] = [
  ["Southside Park", "2 min"],
  ["Estación de Metrorail", "2 min"],
  ["Estación de Metromover", "2 min"],
  ["Mary Brickell Village", "5 min"],
  ["Estación Brightline", "8 min"],
  ["Brickell City Centre", "10 min"],
  ["Bayfront Park", "10 min"],
  ["Bayside Marketplace", "11 min"],
  ["Kaseya Center", "12 min"],
  ["Museo de Ciencias Frost", "13 min"],
  ["Pérez Art Museum Miami", "13 min"],
  ["Arsht Center", "15 min"],
  ["Key Biscayne", "16 min"],
  ["Aeropuerto Internacional de Miami", "18 min"],
  ["Brickell Key", "20 min"],
]

const TEAM: [string, string, string][] = [
  ["North Development", "Desarrollador", "Une a Oak Capital —cuyo fundador, Ricardo Dunin, desarrolló tres Ritz-Carlton Residences y el hotel Le Sereno en St. Barth— y a Edifica, desarrolladora peruana con más de 60 proyectos entregados."],
  ["Studio Mc+G Architecture", "Arquitectura", "Especialistas en hotelería; su fundadora dirigió el diseño de más de 500 proyectos en Kobi Karp, incluida la restauración del Hotel Delano."],
  ["Urban Robot Associates", "Diseño de interiores", "Colectivo de diseño enfocado en hotelería, arquitectura y paisajismo."],
  ["North Management", "Administración", "Creada por North Development para operar sus propiedades con estándares de hotelería de lujo."],
  ["Cervera Real Estate", "Ventas y marketing exclusivos", "Empresa familiar del sur de Florida con más de medio siglo en el mercado."],
]

const WHY_CATHERINE: [string, string][] = [
  ["Asesoría en español, de principio a fin", "Le acompañamos desde la primera llamada hasta el cierre, con explicaciones claras en cada etapa."],
  ["Números antes que entusiasmo", "Revisamos depósitos, gastos y escenarios con la documentación vigente, sin promesas de rentabilidad."],
  ["Compra a distancia", "Coordinamos el proceso para que pueda invertir desde su país sin tener que viajar en cada paso."],
  ["La unidad correcta para usted", "Con la lista completa de disponibilidad, le ayudamos a elegir piso, orientación y tipo según su objetivo."],
]

const FAQS: { q: string; a: string }[] = [
  {
    q: "¿Dónde está Domus Brickell Center?",
    a: `En ${ADDRESS}, en Brickell, el distrito financiero de Miami. Según el folleto del desarrollador, está a 2 minutos de las estaciones de Metrorail y Metromover, a 5 de Mary Brickell Village, a 10 de Brickell City Centre y a 18 del Aeropuerto Internacional de Miami.`,
  },
  {
    q: "¿Cuánto cuesta un FLAT en Domus Brickell Center?",
    a: `Según la lista del desarrollador del ${UNITS_AS_OF}: estudios desde ${fmt(STUDIO_FROM)}, 1 habitación desde ${fmt(ONE_FROM)} y 2 habitaciones desde ${fmt(TWO_FROM)} USD. Hay ${UNITS.length} unidades disponibles en esa lista; el precio depende del piso, la orientación y el modelo, y la disponibilidad cambia con frecuencia.`,
  },
  {
    q: "¿Cuál es el plan de depósitos?",
    a: "10% al firmar el contrato, 10% al inicio de la construcción, 5% dos meses después, 5% a los cuatro meses y 5% a los seis meses del inicio de obra, y el 65% restante al cierre. Es decir, 35% antes del cierre. Para un estudio de $532,900, el 10% inicial es $53,290. Se confirma por escrito en el contrato.",
  },
  {
    q: "¿Los FLATS se entregan amueblados?",
    a: "Sí. Se entregan completamente terminados y amueblados, con pisos de madera, balcón privado, cerradura inteligente, cocina con electrodomésticos Bosch, encimeras de piedra, lavadora y secadora, y agua filtrada con tecnología UV.",
  },
  {
    q: "¿Puedo alquilar mi FLAT?",
    a: "Domus está concebido con servicio tipo hotel: app para huéspedes, recepción y limpieza de hotelería, y un portal de alquiler para propietarios. Según el desarrollador, la plataforma Domus conecta con más de 100 plataformas de reservas y alianzas con Hyatt y Marriott. Las condiciones, costos y reglas del programa y del condominio se confirman con el desarrollador; no se garantizan ingresos ni ocupación.",
  },
  {
    q: "¿Quién desarrolla Domus Brickell Center?",
    a: "North Development (Oak Capital y Edifica), con arquitectura de Studio Mc+G, interiores de Urban Robot Associates, administración de North Management y ventas exclusivas de Cervera Real Estate. Legalmente, el desarrollador es North at Brickell II, LLC.",
  },
  {
    q: "¿Qué amenidades tiene el edificio?",
    a: "Piscina y terraza panorámica en la azotea, bar en la azotea, cabañas, jacuzzi, deck de yoga, gimnasio interior y exterior, salas de tratamiento y baño de vapor, lounge del vestíbulo con restaurante y bar, jardín, coworking y sala de conferencias. Además: recepción y valet 24 horas, pet friendly y estaciones de carga para autos eléctricos.",
  },
  {
    q: "¿Puedo comprar en Miami si vivo fuera de Estados Unidos?",
    a: "Sí. Los extranjeros pueden comprar propiedades en Florida a su nombre o a través de una sociedad. En su análisis personalizado le explicamos el proceso a distancia y los pasos para su caso.",
  },
  {
    q: "¿Cómo agendo una llamada con Catherine?",
    a: "Elija día y hora en el calendario de esta página: la cita queda confirmada al instante, por teléfono o Zoom. También puede escribirnos por WhatsApp o a Sofía, la asistente del sitio.",
  },
]

export default async function DomusPage() {
  const config = await prisma.aIConfig.findFirst().catch(() => null)
  const phone = config?.realtorPhone || "305-283-0872"
  const waDigits = phone.replace(/\D/g, "")
  const waUrl = `https://wa.me/${waDigits.length === 10 ? `1${waDigits}` : waDigits}?text=${encodeURIComponent(
    "Hola, vi la página de Domus Brickell Center y quiero información.",
  )}`

  const all = renderings()
  const featured = new Set([
    HERO, `${IMG_DIR}/torre-dia.jpg`, `${IMG_DIR}/piscina-azotea.jpg`, `${IMG_DIR}/flat-cocina-sala.jpg`,
    `${IMG_DIR}/flat-habitacion.jpg`, `${IMG_DIR}/calle-lobby.jpg`, `${IMG_DIR}/metrorail-brickell.jpg`,
  ])
  const gallery = all.filter(src => !featured.has(src))

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
        areaServed: ["Miami, Florida, USA", "Latinoamérica"],
        knowsLanguage: ["es", "en"],
      },
      {
        "@type": "ApartmentComplex",
        name: "Domus Brickell Center",
        url: PAGE_URL,
        description: DESCRIPTION,
        image: all.map(src => `${BASE}${src}`),
        numberOfAccommodationUnits: 579,
        petsAllowed: true,
        address: {
          "@type": "PostalAddress",
          streetAddress: "1034 SW 2nd Avenue",
          addressLocality: "Miami",
          addressRegion: "FL",
          postalCode: "33130",
          addressCountry: "US",
        },
        containedInPlace: { "@type": "Place", name: "Brickell, Miami" },
        amenityFeature: AMENITIES.map(a => ({ "@type": "LocationFeatureSpecification", name: a, value: true })),
      },
      {
        "@type": "ItemList",
        name: "Tipos de FLAT en Domus Brickell Center",
        itemListElement: UNIT_TYPES.map((u, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "Product",
            name: `Domus Brickell Center — ${u.type}`,
            description: u.body,
            image: `${BASE}${HERO}`,
            offers: {
              "@type": "AggregateOffer",
              lowPrice: fromPrice(u.type),
              highPrice: Math.max(...UNITS.filter(x => x.type === u.type).map(x => x.price)),
              offerCount: UNITS.filter(x => x.type === u.type).length,
              priceCurrency: "USD",
              availability: "https://schema.org/PreOrder",
              url: PAGE_URL,
              seller: { "@id": `${BASE}#agent` },
            },
          },
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

  const btnPrimary = "px-9 py-4 text-[13px] font-medium uppercase tracking-[0.18em] transition hover:brightness-110"
  const btnGhost = "border px-9 py-4 text-[13px] font-medium uppercase tracking-[0.18em] text-white transition hover:bg-white/10"
  const rule = { borderColor: "rgba(23,25,28,.14)" }

  return (
    <main className={`${display.variable} min-h-screen text-[#17191C]`} style={{ background: PAPER }}>
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ---------------------------------------------------------- Hero */}
      {/* Split layout: the render carries its own "domus" crown, so the
          headline sits on a dark panel beside it instead of on top of it. */}
      <section className="grid lg:min-h-[88vh] lg:grid-cols-[1.05fr_1fr]" style={{ background: INK }}>
        <div className="relative h-[52vh] lg:order-2 lg:h-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={HERO} alt={altFor(HERO)} className="absolute inset-0 h-full w-full object-cover object-[30%_center]" />
          <div className="absolute inset-0 lg:hidden" style={{ background: "linear-gradient(to top, rgba(23,25,28,1) 0%, rgba(23,25,28,0) 40%)" }} />
        </div>
        <div className="flex items-center px-6 pb-16 pt-4 text-white lg:order-1 lg:px-14 lg:py-24 xl:pl-[max(3.5rem,calc((100vw-72rem)/2+1.5rem))]">
          <div className="max-w-xl">
            <p className={EYEBROW} style={{ color: GOLD_LIGHT }}>Brickell · Miami, Florida</p>
            <h1 className="mt-7 text-[3rem] font-light lowercase leading-[1] tracking-[0.06em] sm:text-[5rem]" style={{ fontFamily: sans }}>
              domus <span className="mt-2 block text-[1rem] uppercase tracking-[0.5em] text-white/75 sm:text-[1.3rem]">Brickell Center</span>
            </h1>
            <div className="mt-7 h-px w-20" style={{ background: GOLD }} />
            <p className="mt-7 text-xl font-light leading-relaxed text-white/85 sm:text-2xl" style={{ fontFamily: sans }}>
              579 FLATS totalmente amueblados con el servicio de un hotel, en el corazón de Brickell.
            </p>
            <div className="mt-10 flex flex-wrap gap-x-12 gap-y-6">
              {[
                ["Estudios desde", fmt(STUDIO_FROM)],
                ["10% al contrato, desde", fmt(Math.round(STUDIO_FROM * 0.1))],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className={`${EYEBROW} text-white/55`}>{label}</p>
                  <p className="mt-2 text-4xl font-light sm:text-5xl" style={{ fontFamily: sans }}>
                    {value} <span className="text-sm tracking-widest text-white/55">USD</span>
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-11 flex flex-wrap gap-4">
              <a href="#agendar" className={btnPrimary} style={{ background: GOLD_LIGHT, color: INK }}>Agendar una llamada</a>
              <a href="#disponibilidad" className={btnGhost} style={{ borderColor: "rgba(255,255,255,.35)" }}>Ver unidades y precios</a>
              <a href={waUrl} className={btnGhost} style={{ borderColor: "rgba(255,255,255,.35)" }}>WhatsApp</a>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- Facts strip */}
      <section aria-label="Datos del proyecto" style={{ background: INK }}>
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-10 px-6 py-14 sm:grid-cols-4">
          {FACTS.map(([n, l]) => (
            <div key={l} className="text-center">
              <p className="text-3xl font-light sm:text-5xl" style={{ fontFamily: sans, color: GOLD_LIGHT }}>{n}</p>
              <p className={`mt-3 ${EYEBROW} text-white/50`}>{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------- The project */}
      <section id="proyecto" className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div>
            <p className={EYEBROW} style={{ color: GOLD }}>El proyecto</p>
            <h2 className={H2} style={{ fontFamily: sans }}>La comodidad de su hogar, con el servicio y la seguridad de un hotel</h2>
            <p className="mt-8 text-lg leading-relaxed text-[#4A4D52]">
              Domus Brickell Center es una torre de 35 pisos con 579 FLATS —estudios, una y dos
              habitaciones— que se entregan terminados y amueblados. Recepción y valet las 24 horas,
              limpieza de hotelería y una app propia para huéspedes y propietarios.
            </p>
            <p className="mt-5 text-lg leading-relaxed text-[#4A4D52]">
              Brickell es el núcleo financiero de Miami: restaurantes de clase mundial, vida social que
              no se detiene y las playas a minutos. Dirección: <strong className="font-medium text-[#17191C]">{ADDRESS}</strong>.
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${IMG_DIR}/torre-dia.jpg`} alt={altFor("torre-dia.jpg")} className="max-h-[38rem] w-full object-cover" />
        </div>
      </section>

      {/* --------------------------------------------------- The FLATS */}
      <section id="flats" className="py-20 sm:py-24" style={{ background: STONE }}>
        <div className="mx-auto max-w-6xl px-6">
          <p className={EYEBROW} style={{ color: GOLD }}>Los FLATS</p>
          <h2 className={`${H2} max-w-3xl`} style={{ fontFamily: sans }}>Sentirse en casa dondequiera que esté</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${IMG_DIR}/flat-cocina-sala.jpg`} alt={altFor("flat-cocina-sala.jpg")} className="h-72 w-full object-cover sm:h-96" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${IMG_DIR}/flat-habitacion.jpg`} alt={altFor("flat-habitacion.jpg")} className="h-72 w-full object-cover sm:h-96" />
          </div>
          <div className="mt-14 grid gap-14 lg:grid-cols-2">
            <div>
              {UNIT_TYPES.map(u => {
                const units = UNITS.filter(x => x.type === u.type)
                const sizes = units.map(x => x.sqft)
                return (
                  <div key={u.type} className="border-t py-6" style={rule}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                      <h3 className="text-2xl font-light" style={{ fontFamily: sans }}>{u.type === "Estudio" ? "Estudios" : u.type}</h3>
                      <p className="text-xl font-light" style={{ fontFamily: sans, color: GOLD }}>
                        desde {fmt(fromPrice(u.type))} <span className="text-xs tracking-widest text-[#6B6E73]">USD</span>
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-[#6B6E73]">
                      {Math.min(...sizes)} – {Math.max(...sizes)} pies² interiores ({Math.round(Math.min(...sizes) * 0.0929)} – {Math.round(Math.max(...sizes) * 0.0929)} m²) · {units.length} disponibles
                    </p>
                    <p className="mt-2 leading-relaxed text-[#4A4D52]">{u.body}</p>
                  </div>
                )
              })}
            </div>
            <div>
              <h3 className={`${EYEBROW} text-[#6B6E73]`}>Incluido en cada FLAT</h3>
              <ul className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {FLAT_FEATURES.map(t => (
                  <li key={t} className="flex gap-3 leading-relaxed">
                    <span className="mt-3 h-px w-4 shrink-0" style={{ background: GOLD }} aria-hidden="true" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ Availability */}
      <section id="disponibilidad" className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <p className={EYEBROW} style={{ color: GOLD }}>Disponibilidad</p>
        <h2 className={`${H2} max-w-3xl`} style={{ fontFamily: sans }}>Unidades disponibles y precios</h2>
        <p className="mt-6 max-w-3xl text-[#4A4D52]">
          Lista del desarrollador del {UNITS_AS_OF}: {UNITS.length} unidades. La disponibilidad cambia a diario;
          antes de decidir, le confirmamos la unidad por escrito.
        </p>
        {UNIT_TYPES.map(t => (
          <div key={t.type} className="mt-10">
            <h3 className="text-xl font-light" style={{ fontFamily: sans }}>{t.type === "Estudio" ? "Estudios" : t.type}</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b text-[11px] uppercase tracking-[0.18em] text-[#6B6E73]" style={rule}>
                    <th scope="col" className="py-3 pr-4 font-medium">Unidad</th>
                    <th scope="col" className="py-3 pr-4 font-medium">Modelo</th>
                    <th scope="col" className="py-3 pr-4 font-medium">Interior</th>
                    <th scope="col" className="py-3 pr-4 font-medium">Balcón</th>
                    <th scope="col" className="py-3 pr-4 font-medium">Orientación</th>
                    <th scope="col" className="py-3 pr-4 font-medium">Huéspedes</th>
                    <th scope="col" className="py-3 pr-4 font-medium">Detalle</th>
                    <th scope="col" className="py-3 text-right font-medium">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {UNITS.filter(u => u.type === t.type).map(u => (
                    <tr key={u.unit} className="border-b" style={{ borderColor: "rgba(23,25,28,.07)" }}>
                      <td className="py-3 pr-4 font-medium">{u.unit}</td>
                      <td className="py-3 pr-4">{u.model}</td>
                      <td className="py-3 pr-4 tabular-nums">{u.sqft} ft²</td>
                      <td className="py-3 pr-4 tabular-nums">{u.terraceSqft ? `${u.terraceSqft} ft²` : "—"}</td>
                      <td className="py-3 pr-4">{u.exposure}</td>
                      <td className="py-3 pr-4">{u.capacity}</td>
                      <td className="py-3 pr-4 text-[#6B6E73]">{u.features || "—"}</td>
                      <td className="py-3 text-right tabular-nums">{fmt(u.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        <p className="mt-6 text-xs leading-relaxed text-[#8A8C90]">
          Orientación: N norte, S sur, E este, W oeste. Pies² aproximados según el desarrollador. Precios en USD sujetos a cambio sin previo aviso.
        </p>
        <a href="#agendar" className={`${btnPrimary} mt-8 inline-block text-white`} style={{ background: CHARCOAL }}>
          Quiero que me ayuden a elegir unidad
        </a>
      </section>

      {/* ---------------------------------------------------- Amenities */}
      <section id="amenidades" className="py-20 text-white sm:py-24" style={{ background: INK }}>
        <div className="mx-auto max-w-6xl px-6">
          <p className={EYEBROW} style={{ color: GOLD_LIGHT }}>Amenidades</p>
          <h2 className={`${H2} max-w-3xl`} style={{ fontFamily: sans }}>Todas las comodidades que importan</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${IMG_DIR}/piscina-azotea.jpg`} alt={altFor("piscina-azotea.jpg")} className="mt-12 h-72 w-full object-cover sm:h-[30rem]" />
          <ul className="mt-12 grid gap-x-10 gap-y-6 sm:grid-cols-3">
            {AMENITIES.map((a, i) => (
              <li key={a} className="border-t pt-5" style={{ borderColor: "rgba(226,203,156,.25)" }}>
                <span className="text-sm tracking-[0.2em]" style={{ color: GOLD_LIGHT }} aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                <span className="mt-2 block text-xl font-light" style={{ fontFamily: sans }}>{a}</span>
              </li>
            ))}
          </ul>
          <div className="mt-16 grid gap-12 lg:grid-cols-2">
            <div>
              <h3 className={`${EYEBROW} text-white/55`}>Servicios</h3>
              <ul className="mt-6 space-y-4 text-white/80">
                {SERVICES.map(s => (
                  <li key={s} className="flex gap-4"><span className="mt-3 h-px w-5 shrink-0" style={{ background: GOLD_LIGHT }} aria-hidden="true" />{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className={`${EYEBROW} text-white/55`}>Agua y aire limpios</h3>
              <p className="mt-6 leading-relaxed text-white/75">
                Purificación de agua en el punto de entrada para cada grifo y ducha, y purificadores de aire con
                filtro MERV-16 en las áreas comunes. Ventanas resistentes a impactos de viento y edificio pet friendly.
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${IMG_DIR}/calle-lobby.jpg`} alt={altFor("calle-lobby.jpg")} className="mt-8 h-64 w-full object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------- Domus app / rental reach */}
      <section id="alquiler" className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="grid gap-14 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className={EYEBROW} style={{ color: GOLD }}>App Domus · portal del propietario</p>
            <h2 className={H2} style={{ fontFamily: sans }}>Sea propietario en Brickell y conéctese con el mundo</h2>
          </div>
          <div className="space-y-5 text-lg leading-relaxed text-[#4A4D52]">
            <p>
              Los huéspedes hacen check-in móvil, usan llaves digitales y piden servicios desde la app Domus.
              Para los propietarios, la plataforma conecta las propiedades con más de 100 plataformas de reservas
              y alcanza 1.4 mil millones de vistas mensuales, según el desarrollador.
            </p>
            <p>
              Mediante alianzas con Hyatt, Marriott y otras marcas globales, las unidades tienen acceso a más de
              100 millones de miembros de Marriott Bonvoy y World of Hyatt.
            </p>
            <p className="text-xs leading-relaxed text-[#8A8C90]">
              Cifras anunciadas por el desarrollador. Las condiciones, costos y reglas del programa de alquiler y del
              condominio se confirman con el desarrollador y en los contratos. No se garantizan ingresos, ocupación ni rentabilidad.
            </p>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- Location */}
      <section id="ubicacion" className="py-20 sm:py-24" style={{ background: STONE }}>
        <div className="mx-auto max-w-6xl px-6">
          <p className={EYEBROW} style={{ color: GOLD }}>Ubicación</p>
          <h2 className={`${H2} max-w-3xl`} style={{ fontFamily: sans }}>En el centro de todo</h2>
          <div className="mt-12 grid gap-12 lg:grid-cols-2">
            <ul className="grid grid-cols-1 gap-x-8">
              {PROXIMITY.map(([p, t]) => (
                <li key={p} className="flex items-baseline justify-between gap-4 border-t py-3" style={rule}>
                  <span>{p}</span><span className="tabular-nums" style={{ color: GOLD }}>{t}</span>
                </li>
              ))}
            </ul>
            <div>
              <iframe
                title={`Mapa de Domus Brickell Center, ${ADDRESS}`}
                src={`https://www.google.com/maps?q=${encodeURIComponent(ADDRESS)}&output=embed`}
                className="h-[22rem] w-full border"
                style={rule}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${IMG_DIR}/metrorail-brickell.jpg`} alt={altFor("metrorail-brickell.jpg")} loading="lazy" className="mt-6 h-48 w-full object-cover" />
            </div>
          </div>
          <p className="mt-6 text-xs text-[#8A8C90]">Tiempos aproximados según el folleto del desarrollador.</p>
        </div>
      </section>

      {/* ----------------------------------------------------- Deposits */}
      <section id="depositos" className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <p className={EYEBROW} style={{ color: GOLD }}>Plan de depósitos</p>
        <h2 className={`${H2} max-w-3xl`} style={{ fontFamily: sans }}>35% antes del cierre, en seis etapas</h2>
        <div className="mt-12 grid items-start gap-12 lg:grid-cols-2">
          <ol className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3">
            {DEPOSITS.map((d, i) => (
              <li key={d.when} className="border-t pt-5" style={rule}>
                <p className={`${EYEBROW} text-[#6B6E73]`}>Etapa {i + 1}</p>
                <p className="mt-3 text-5xl font-light" style={{ fontFamily: sans, color: GOLD }}>{d.pct}%</p>
                <p className="mt-3 text-sm leading-relaxed text-[#4A4D52]">{d.when}</p>
              </li>
            ))}
          </ol>
          <DepositCalculator stages={DEPOSITS} initialPrice={STUDIO_FROM} />
        </div>
        <p className="mt-8 text-xs leading-relaxed text-[#8A8C90]">
          Calendario de depósitos del desarrollador, sujeto a la documentación comercial vigente y al contrato.
        </p>
      </section>

      {/* -------------------------------------------------------- Team */}
      <section id="equipo" className="py-20 text-white sm:py-24" style={{ background: CHARCOAL }}>
        <div className="mx-auto max-w-6xl px-6">
          <p className={EYEBROW} style={{ color: GOLD_LIGHT }}>Equipo</p>
          <h2 className={`${H2} max-w-3xl`} style={{ fontFamily: sans }}>Todos los líderes del sector. Toda la experiencia necesaria.</h2>
          <div className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {TEAM.map(([n, role, b]) => (
              <div key={n} className="border-t pt-6" style={{ borderColor: "rgba(226,203,156,.25)" }}>
                <p className={`${EYEBROW} text-white/50`}>{role}</p>
                <h3 className="mt-3 text-2xl font-light" style={{ fontFamily: sans }}>{n}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/65">{b}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 text-xs leading-relaxed text-white/40">
            Antecedentes corporativos anunciados por el desarrollador. No constituyen garantía de entrega, rendimiento ni éxito futuro del proyecto.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------- Book a call */}
      <section id="agendar" className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="grid gap-14 lg:grid-cols-[1fr_1.25fr]">
          <div>
            <p className={EYEBROW} style={{ color: GOLD }}>Agende una llamada</p>
            <h2 className={H2} style={{ fontFamily: sans }}>Hable con Catherine Gomez</h2>
            <p className="mt-8 text-lg leading-relaxed text-[#4A4D52]">
              Elija el día y la hora que le convengan, por teléfono o Zoom. Revisamos juntos las unidades
              disponibles, el plan de depósitos y cómo comprar desde su país.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${IMG_DIR}/skyline-noche.jpg`} alt={altFor("skyline-noche.jpg")} loading="lazy" className="mt-10 hidden h-72 w-full object-cover lg:block" />
          </div>
          <div>
            <BookingForm />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- Why Catherine */}
      <section id="asesoria" className="py-20 sm:py-24" style={{ background: STONE }}>
        <div className="mx-auto max-w-6xl px-6">
          <p className={EYEBROW} style={{ color: GOLD }}>Su asesoría</p>
          <h2 className={`${H2} max-w-3xl`} style={{ fontFamily: sans }}>¿Por qué invertir con la asesoría de Catherine Gomez?</h2>
          <div className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2">
            {WHY_CATHERINE.map(([t, b]) => (
              <div key={t} className="border-t pt-6" style={rule}>
                <h3 className="text-2xl font-light" style={{ fontFamily: sans }}>{t}</h3>
                <p className="mt-3 leading-relaxed text-[#4A4D52]">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ Gallery */}
      {gallery.length > 0 && (
        <section id="galeria" className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <p className={EYEBROW} style={{ color: GOLD }}>Galería</p>
          <h2 className={H2} style={{ fontFamily: sans }}>Así se proyecta Domus Brickell Center</h2>
          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {gallery.map(src => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt={altFor(src)} loading="lazy" className="h-72 w-full object-cover" />
            ))}
          </div>
          <p className="mt-6 text-xs text-[#8A8C90]">Representaciones artísticas conceptuales del desarrollador. Acabados, mobiliario y vistas pueden variar.</p>
        </section>
      )}

      {/* ------------------------------------------------- Lead form */}
      <section id="analisis" className="py-20 text-white sm:py-24" style={{ background: INK }}>
        <div className="mx-auto grid max-w-6xl gap-14 px-6 lg:grid-cols-[1fr_1.25fr]">
          <div>
            <p className={EYEBROW} style={{ color: GOLD_LIGHT }}>Análisis personalizado</p>
            <h2 className={H2} style={{ fontFamily: sans }}>¿Prefiere recibir la información por escrito?</h2>
            <p className="mt-8 text-lg leading-relaxed text-white/70">
              Responda unas preguntas y le preparamos un análisis de Domus Brickell Center con:
            </p>
            <ul className="mt-8 space-y-4 text-white/75">
              {[
                "Las unidades disponibles que encajan con su presupuesto",
                "El plan de depósitos aplicado a la unidad que elija",
                "Los gastos a considerar además del precio",
                "Cómo comprar desde su país, paso a paso",
              ].map(t => (
                <li key={t} className="flex gap-4"><span className="mt-3 h-px w-5 shrink-0" style={{ background: GOLD_LIGHT }} aria-hidden="true" />{t}</li>
              ))}
            </ul>
            <div className="mt-10 space-y-1 text-sm text-white/55">
              <p className="font-medium text-white/80">Catherine Gomez Realtors Group</p>
              <p>Teléfono / WhatsApp: <a href={waUrl} className="underline">305.283.0872</a></p>
              <p>Correo: <a href="mailto:info@catherinegomezrealtor.com" className="underline">info@catherinegomezrealtor.com</a></p>
            </div>
          </div>
          <div className="relative text-[#17191C]">
            <LeadForm waUrl={waUrl} />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- FAQ */}
      <section id="preguntas" className="mx-auto max-w-4xl px-6 py-20 sm:py-24">
        <p className={EYEBROW} style={{ color: GOLD }}>Preguntas frecuentes</p>
        <h2 className={H2} style={{ fontFamily: sans }}>Lo que los inversionistas preguntan primero</h2>
        <div className="mt-12">
          {FAQS.map(f => (
            <details key={f.q} className="group border-t py-6" style={rule}>
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-left">
                <h3 className="text-xl font-light leading-snug" style={{ fontFamily: sans }}>{f.q}</h3>
                <span className="mt-1 shrink-0 text-lg font-light transition group-open:rotate-45" style={{ color: GOLD }} aria-hidden="true">+</span>
              </summary>
              <p className="mt-4 max-w-3xl leading-relaxed text-[#4A4D52]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------- Closing CTA */}
      <section className="py-20 text-center text-white sm:py-24" style={{ background: INK }}>
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-[2rem] font-light leading-[1.15] sm:text-[2.8rem]" style={{ fontFamily: sans }}>
            FLATS amueblados en Brickell desde {fmt(STUDIO_FROM)}
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-white/60">Agende su llamada con Catherine Gomez y elija su unidad con información.</p>
          <div className="mt-11 flex flex-wrap justify-center gap-4">
            <a href="#agendar" className={btnPrimary} style={{ background: GOLD_LIGHT, color: INK }}>Agendar una llamada</a>
            <a href={waUrl} className={btnGhost} style={{ borderColor: "rgba(255,255,255,.35)" }}>WhatsApp</a>
          </div>
        </div>
      </section>

      <footer className="py-12 text-center text-sm" style={{ background: INK, color: "rgba(255,255,255,.45)" }}>
        <p className={EYEBROW}>Catherine Gomez Realtors Group · Miami, Florida</p>
        <p className="mx-auto mt-5 max-w-3xl px-6 text-xs leading-relaxed text-white/30">
          Domus Brickell Center es desarrollado por North at Brickell II, LLC. Oak Capital está afiliada a esta entidad,
          pero no es la desarrolladora del proyecto. Las imágenes son representaciones artísticas conceptuales y pueden
          cambiar sin previo aviso. Precios, disponibilidad, planos, amenidades, servicios, fechas y condiciones están
          sujetos a cambio y se confirman por escrito en la documentación del desarrollador. Las representaciones orales
          no pueden considerarse como declaraciones correctas del desarrollador; para las declaraciones correctas,
          consulte el folleto y los documentos requeridos por la sección 718.503 de los Estatutos de Florida que el
          desarrollador debe entregar al comprador. Esta página no constituye una oferta de venta ni asesoría
          financiera, legal o tributaria.
        </p>
      </footer>
    </main>
  )
}
