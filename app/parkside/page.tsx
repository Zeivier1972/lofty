export const dynamic = "force-dynamic"

import { readdirSync } from "fs"
import { join } from "path"
import type { Metadata } from "next"
import { Cormorant_Garamond } from "next/font/google"
import { prisma } from "@/lib/prisma"
import LeadForm from "./lead-form"
import DepositCalculator, { type DepositStage } from "./deposit-calculator"

/**
 * Parkside Residences at Brickell — investment landing page for Colombian
 * investors arriving from Meta ads.
 *
 * Content rule for this page, from the client's brief: only what the
 * developer's presentation says. No starting price, no inventory, no delivery
 * date, no HOA, no ROI, and the Wello "two years without commission" incentive
 * stays off until the developer confirms it. Where a visitor needs one of
 * those, the page sends them to the qualification form instead.
 */

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-display",
  display: "swap",
})

/** Palette taken from the Parkside brand: forest green, cream, sand. */
const FOREST = "#1E2B23"
const GREEN = "#2E4236"
const CREAM = "#F6F3EC"
const SAND = "#B59A6A"
const SAND_LIGHT = "#D9C7A0"

const serif = "var(--font-display), Georgia, serif"
const EYEBROW = "text-[11px] font-medium uppercase tracking-[0.34em]"
const H2 = "mt-6 text-[2.1rem] font-light leading-[1.12] sm:text-[3rem]"

const BASE = "https://www.catherinegomezrealtor.com"
const PAGE_URL = `${BASE}/parkside`
const IMG_DIR = "/parkside"
const HERO = `${IMG_DIR}/fachada-atardecer.jpg`

const TITLE = "Parkside Residences at Brickell — Invertir en Miami frente a Simpson Park | Catherine Gomez"
const DESCRIPTION =
  "Parkside Residences at Brickell: edificio boutique de 8 pisos con 187 residencias amuebladas frente a Simpson Park, en Brickell, Miami. Estudios, 1 y 2 habitaciones, 16,500 pies² de amenidades y programa de administración de alquileres. Solicite su análisis de inversión personalizado con Catherine Gomez."

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "Parkside Residences at Brickell",
    "Parkside Brickell",
    "Parkside Miami",
    "invertir en Miami desde Colombia",
    "apartamentos en Brickell",
    "preconstrucción Brickell",
    "apartamentos amueblados Miami",
    "Simpson Park Miami",
    "BI Group USA",
    "comprar apartamento en Miami siendo extranjero",
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: PAGE_URL,
    type: "website",
    siteName: "Catherine Gomez Realtor",
    locale: "es_CO",
    // opengraph-image.tsx / twitter-image.tsx generate the 1200x630 card.
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
}

/** Official Parkside renderings, from public/parkside/. New files join the gallery on their own. */
function renderings(): string[] {
  try {
    return readdirSync(join(process.cwd(), "public", "parkside"))
      .filter(f => /\.(jpe?g|png|webp|avif)$/i.test(f))
      .sort()
      .map(f => `${IMG_DIR}/${f}`)
  } catch {
    return []
  }
}

const ALT: Record<string, string> = {
  "fachada-atardecer.jpg": "Parkside Residences at Brickell al atardecer: edificio boutique de 8 pisos con balcones de vidrio, terrazas ajardinadas y palmeras",
  "fachada-frontal.jpg": "Fachada frontal de Parkside Residences at Brickell con balcones, paneles de madera y vegetación en la azotea",
  "fachada-calle.jpg": "Planta baja de Parkside Residences at Brickell a nivel de calle, con lobby iluminado y árboles en la acera",
  "lobby-lounge.jpg": "Lounge del lobby de Parkside con sofás verdes, biblioteca de madera, lámparas de mimbre y plantas colgantes",
  "recepcion.jpg": "Recepción de Parkside Residences con mostrador de piedra, lámparas de fibra natural y el letrero PARKSIDE",
  "piscina-azotea.jpg": "Piscina en la azotea de Parkside con camastros, bar cubierto y vista al skyline de Brickell y a la bahía",
  "estudio-sala.jpg": "Estudio amueblado de Parkside con cama, sofá, comedor y ventanales de piso a techo con cortinas de lino",
  "estudio-cocina.jpg": "Cocina y sala de una residencia de Parkside con gabinetes de madera, encimera de cuarzo, horno integrado y televisor",
  "recamara-vista.jpg": "Habitación de una residencia de Parkside con cabecera tapizada, lámparas colgantes y ventanal con vista a Miami",
  "sala-vista.jpg": "Sala de una residencia de Parkside con sofá, mesa de centro, mueble de TV y ventanal hacia la ciudad",
  "bano.jpg": "Baño de una residencia de Parkside con azulejo verde en la ducha, mueble de madera y espejo orgánico iluminado",
}
const altFor = (src: string) =>
  ALT[src.split("/").pop() || ""] || "Render oficial de Parkside Residences at Brickell en Miami"

const FACTS: [string, string][] = [
  ["8", "pisos · edificio boutique"],
  ["187", "residencias amuebladas"],
  ["16,500", "pies² de amenidades"],
  ["Simpson Park", "frente al parque"],
]

const RESIDENCE_FEATURES = [
  "Residencias amuebladas",
  "Ventanales de piso a techo",
  "Cocinas Italkraft",
  "Encimeras de cuarzo",
  "Electrodomésticos Bosch",
  "Lavadora y secadora en la residencia",
  "Acabados contemporáneos",
  "Baños con acabados de porcelanato",
]

const UNIT_TYPES: { type: string; body: string }[] = [
  { type: "Estudios", body: "Distribución eficiente y amueblada, pensada para quien busca una primera inversión en Brickell." },
  { type: "1 habitación", body: "Más espacio para vivir o para recibir huéspedes, con cocina y lavandería dentro de la residencia." },
  { type: "2 habitaciones", body: "La opción para familias o para quien quiere un pie de casa en Miami con espacio para todos." },
]

const AMENITIES = [
  "Piscina",
  "Spa",
  "Gimnasio",
  "Estudio de yoga",
  "Sala de spinning",
  "Coworking lounge",
  "Sala de conferencias",
  "Health market",
  "Lounge exterior y bar",
]

const WELLO_SERVICES = [
  "Gestión de reservaciones",
  "Comercialización y fotografía",
  "Distribución en plataformas",
  "Optimización de anuncios",
  "Administración de ingresos",
  "Reportes para el propietario",
  "Atención de huéspedes",
  "Coordinación de limpieza y mantenimiento",
]

/** As announced in the developer's deposit-structure sheet. */
const DEPOSITS: DepositStage[] = [
  { pct: 20, when: "Al firmar el contrato" },
  { pct: 10, when: "A los 90 días" },
  { pct: 10, when: "Al top-off de la construcción" },
  { pct: 60, when: "Al cierre" },
]

const LOCATION: [string, string][] = [
  ["Frente a Simpson Park", "Un espacio natural dentro de Brickell: la tranquilidad del parque al cruzar la calle."],
  ["The Underline", "El parque lineal de Miami, con senderos y ciclovía, en el mismo entorno."],
  ["Brickell City Centre", "Compras, restaurantes y entretenimiento en el corazón del barrio."],
  ["El distrito financiero de Miami", "Brickell concentra banca, oficinas y vida residencial: una de las zonas más reconocidas de la ciudad."],
]

const WHY_CATHERINE: [string, string][] = [
  ["Asesoría en español, de principio a fin", "Le acompañamos desde la primera llamada hasta el cierre, con explicaciones claras en cada etapa."],
  ["Números antes que entusiasmo", "Le ayudamos a revisar depósitos, gastos y escenarios de alquiler con la documentación vigente, sin promesas de rentabilidad."],
  ["Compra a distancia", "Coordinamos el proceso para que pueda invertir desde Colombia sin tener que viajar en cada paso."],
  ["Un análisis hecho para usted", "Comparamos Parkside con sus objetivos y su presupuesto para que decida con información."],
]

const FAQS: { q: string; a: string }[] = [
  {
    q: "¿Dónde está ubicado Parkside Residences at Brickell?",
    a: "En Brickell, Miami, Florida, frente a Simpson Park. El entorno incluye The Underline, Brickell City Centre y el distrito financiero y residencial de Brickell.",
  },
  {
    q: "¿Quién desarrolla Parkside?",
    a: "El desarrollador es BI Group USA, y la arquitectura y el diseño interior son de Kobi Karp Architecture and Interior Design. BI Group anuncia 30 años de experiencia y más de 400 proyectos completados; estos son antecedentes corporativos, no una garantía sobre este proyecto.",
  },
  {
    q: "¿Qué tipos de residencia tiene Parkside?",
    a: "Estudios, apartamentos de 1 habitación y apartamentos de 2 habitaciones, en un edificio boutique de 8 pisos con 187 residencias.",
  },
  {
    q: "¿Las residencias se entregan amuebladas?",
    a: "Sí. El proyecto presenta residencias amuebladas, con cocinas Italkraft, encimeras de cuarzo, electrodomésticos Bosch y lavadora y secadora dentro de la residencia.",
  },
  {
    q: "¿Cuál es la estructura de depósitos?",
    a: "El calendario anunciado es 20% al firmar el contrato, 10% a los 90 días, 10% al alcanzar el top-off de la construcción y el 60% restante al cierre. Debe confirmarse con la documentación comercial vigente antes de firmar.",
  },
  {
    q: "¿Cuánto cuesta un apartamento en Parkside?",
    a: "Los precios y la disponibilidad cambian con frecuencia, por eso no los publicamos aquí. Al solicitar su análisis personalizado le enviamos los precios vigentes, los planos disponibles y el cálculo de depósitos para la residencia que le interese.",
  },
  {
    q: "¿Puedo alquilar mi residencia?",
    a: "Parkside presenta un programa de administración de alquileres asociado con Wello, que incluye reservaciones, comercialización, atención de huéspedes, limpieza y reportes. Las condiciones, costos y restricciones del programa y del edificio se confirman con el desarrollador. No se garantizan ingresos ni ocupación.",
  },
  {
    q: "¿Qué amenidades tiene el edificio?",
    a: "Aproximadamente 16,500 pies² de amenidades en The Infinity Level: piscina, spa, gimnasio, estudio de yoga, sala de spinning, coworking lounge, sala de conferencias, health market y lounge exterior con bar.",
  },
  {
    q: "¿Puedo comprar en Miami si vivo en Colombia?",
    a: "Sí. Los extranjeros pueden comprar propiedades en Florida, a su nombre o a través de una sociedad. En su análisis personalizado le explicamos el proceso a distancia y los pasos para su caso particular.",
  },
  {
    q: "¿Cuándo se entrega el proyecto?",
    a: "La fecha de entrega la confirma el desarrollador en la documentación vigente y queda establecida en el contrato. Se la indicamos en su análisis personalizado.",
  },
]

export default async function ParksidePage() {
  const config = await prisma.aIConfig.findFirst().catch(() => null)
  const phone = config?.realtorPhone || "305-283-0872"
  const waDigits = phone.replace(/\D/g, "")
  const waUrl = `https://wa.me/${waDigits.length === 10 ? `1${waDigits}` : waDigits}?text=${encodeURIComponent(
    "Hola, vi la página de Parkside Residences at Brickell y quiero recibir un análisis de inversión.",
  )}`

  const all = renderings()
  const featured = new Set([
    HERO, `${IMG_DIR}/fachada-frontal.jpg`, `${IMG_DIR}/piscina-azotea.jpg`,
    `${IMG_DIR}/lobby-lounge.jpg`, `${IMG_DIR}/estudio-sala.jpg`, `${IMG_DIR}/estudio-cocina.jpg`,
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
        areaServed: ["Miami, Florida, USA", "Colombia"],
        knowsLanguage: ["es", "en"],
      },
      {
        "@type": "ApartmentComplex",
        name: "Parkside Residences at Brickell",
        url: PAGE_URL,
        description: DESCRIPTION,
        image: all.map(src => `${BASE}${src}`),
        numberOfAccommodationUnits: 187,
        address: {
          "@type": "PostalAddress",
          addressLocality: "Miami",
          addressRegion: "FL",
          addressCountry: "US",
        },
        containedInPlace: { "@type": "Place", name: "Brickell, Miami" },
        amenityFeature: AMENITIES.map(a => ({ "@type": "LocationFeatureSpecification", name: a, value: true })),
      },
      {
        "@type": "ItemList",
        name: "Tipos de residencia en Parkside Residences at Brickell",
        itemListElement: UNIT_TYPES.map((u, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: u.type,
          description: u.body,
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

  return (
    <main className={`${display.variable} min-h-screen text-[#1E2B23]`} style={{ background: CREAM }}>
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ---------------------------------------------------------- Hero */}
      <section className="relative flex min-h-[88vh] items-end">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={HERO} alt={altFor(HERO)} className="absolute inset-0 h-full w-full object-cover" />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(30,43,35,.94) 0%, rgba(30,43,35,.6) 30%, rgba(30,43,35,.1) 65%, rgba(30,43,35,0) 100%)" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to right, rgba(30,43,35,.7) 0%, rgba(30,43,35,.25) 50%, rgba(30,43,35,0) 80%)" }}
        />
        <div className="relative mx-auto w-full max-w-6xl px-6 pb-20 pt-32 text-white sm:pb-28">
          <p className={EYEBROW} style={{ color: SAND_LIGHT }}>Brickell · Miami, Florida</p>
          <h1 className="mt-7 max-w-3xl text-[2.7rem] font-light leading-[1.02] tracking-wide sm:text-[5rem]" style={{ fontFamily: serif }}>
            Parkside Residences<br />at Brickell
          </h1>
          <div className="mt-7 h-px w-20" style={{ background: SAND }} />
          <p className="mt-7 max-w-xl text-xl font-light leading-relaxed text-white/85 sm:text-2xl" style={{ fontFamily: serif }}>
            Invierta con información en un proyecto boutique frente a Simpson Park, en el corazón de Brickell.
          </p>
          <div className="mt-11 flex flex-wrap gap-4">
            <a href="#analisis" className={btnPrimary} style={{ background: SAND, color: FOREST }}>
              Solicitar mi análisis personalizado
            </a>
            <a href={waUrl} className={btnGhost} style={{ borderColor: "rgba(255,255,255,.35)" }}>
              WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- Facts strip */}
      <section aria-label="Datos del proyecto" style={{ background: FOREST }}>
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-10 px-6 py-14 sm:grid-cols-4">
          {FACTS.map(([n, l]) => (
            <div key={l} className="text-center">
              <p className="text-3xl font-light sm:text-5xl" style={{ fontFamily: serif, color: SAND_LIGHT }}>{n}</p>
              <p className={`mt-3 ${EYEBROW} text-white/50`}>{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------- The project */}
      <section id="proyecto" className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div>
            <p className={EYEBROW} style={{ color: SAND }}>El proyecto</p>
            <h2 className={H2} style={{ fontFamily: serif }}>
              Donde la energía de Miami se encuentra con la tranquilidad de Simpson Park
            </h2>
            <p className="mt-8 text-lg leading-relaxed text-[#4F5A52]">
              Parkside es una propuesta residencial boutique en Brickell: 8 pisos y 187 residencias
              amuebladas que combinan vida urbana, naturaleza, bienestar y espacios sociales.
            </p>
            <p className="mt-5 text-lg leading-relaxed text-[#4F5A52]">
              Desarrollado por <strong className="font-medium text-[#1E2B23]">BI Group USA</strong>, con
              arquitectura y diseño interior de{" "}
              <strong className="font-medium text-[#1E2B23]">Kobi Karp Architecture and Interior Design</strong>.
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${IMG_DIR}/fachada-frontal.jpg`} alt={altFor("fachada-frontal.jpg")} className="w-full object-cover" />
        </div>

        <div className="mt-16 grid gap-8 border-t pt-10 sm:grid-cols-3" style={{ borderColor: "rgba(30,43,35,.14)" }}>
          {[
            ["30 años", "de experiencia del desarrollador"],
            ["400+", "proyectos completados"],
            ["~95 millones", "de pies² residenciales desarrollados"],
          ].map(([n, l]) => (
            <div key={l}>
              <p className="text-3xl font-light" style={{ fontFamily: serif, color: GREEN }}>{n}</p>
              <p className="mt-2 text-sm text-[#6B7068]">{l}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs leading-relaxed text-[#8A857A]">
          Antecedentes corporativos anunciados por BI Group. No constituyen garantía de entrega,
          rendimiento financiero ni éxito futuro del proyecto.
        </p>
      </section>

      {/* ----------------------------------------------------- Location */}
      <section id="ubicacion" className="py-20 sm:py-24" style={{ background: "#EDE7DA" }}>
        <div className="mx-auto max-w-6xl px-6">
          <p className={EYEBROW} style={{ color: GREEN }}>Ubicación</p>
          <h2 className={`${H2} max-w-3xl`} style={{ fontFamily: serif }}>
            Viva o invierta en una de las zonas más reconocidas de Miami
          </h2>
          <div className="mt-12 grid gap-12 lg:grid-cols-2">
            <ul className="space-y-7">
              {LOCATION.map(([t, b]) => (
                <li key={t} className="border-t pt-5" style={{ borderColor: "rgba(30,43,35,.16)" }}>
                  <strong className="block text-xl font-light" style={{ fontFamily: serif }}>{t}</strong>
                  <span className="mt-2 block leading-relaxed text-[#4F5A52]">{b}</span>
                </li>
              ))}
            </ul>
            <iframe
              title="Mapa de Simpson Park en Brickell, Miami, frente a Parkside Residences"
              src="https://www.google.com/maps?q=Simpson+Park,+Miami,+FL&output=embed"
              className="h-[24rem] w-full border"
              style={{ borderColor: "rgba(30,43,35,.16)" }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>

      {/* --------------------------------------------------- Residences */}
      <section id="residencias" className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <p className={EYEBROW} style={{ color: SAND }}>Las residencias</p>
        <h2 className={`${H2} max-w-3xl`} style={{ fontFamily: serif }}>
          Comodidad, funcionalidad y diseño contemporáneo, listas para usar
        </h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${IMG_DIR}/estudio-sala.jpg`} alt={altFor("estudio-sala.jpg")} className="h-72 w-full object-cover sm:h-96" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${IMG_DIR}/estudio-cocina.jpg`} alt={altFor("estudio-cocina.jpg")} className="h-72 w-full object-cover sm:h-96" />
        </div>
        <div className="mt-14 grid gap-14 lg:grid-cols-2">
          <div>
            {UNIT_TYPES.map(u => (
              <div key={u.type} className="border-t py-6" style={{ borderColor: "rgba(30,43,35,.14)" }}>
                <h3 className="text-2xl font-light" style={{ fontFamily: serif }}>{u.type}</h3>
                <p className="mt-2 leading-relaxed text-[#4F5A52]">{u.body}</p>
              </div>
            ))}
            <p className="border-t pt-6 text-sm leading-relaxed text-[#6B7068]" style={{ borderColor: "rgba(30,43,35,.14)" }}>
              Planos, precios y disponibilidad vigentes:{" "}
              <a href="#analisis" className="underline underline-offset-4" style={{ color: GREEN }}>
                solicítelos en su análisis personalizado
              </a>.
            </p>
          </div>
          <div>
            <h3 className={`${EYEBROW} text-[#6B7068]`}>Incluido en cada residencia</h3>
            <ul className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {RESIDENCE_FEATURES.map(t => (
                <li key={t} className="flex gap-3 leading-relaxed text-[#2B2A26]">
                  <span className="mt-3 h-px w-4 shrink-0" style={{ background: SAND }} aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- Amenities */}
      <section id="amenidades" className="py-20 text-white sm:py-24" style={{ background: FOREST }}>
        <div className="mx-auto max-w-6xl px-6">
          <p className={EYEBROW} style={{ color: SAND_LIGHT }}>Amenidades · The Infinity Level</p>
          <h2 className={`${H2} max-w-3xl`} style={{ fontFamily: serif }}>
            16,500 pies² dedicados al bienestar y a la conexión
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/65">
            Espacios para ejercitarse, trabajar, relajarse y disfrutar del estilo de vida de Brickell.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${IMG_DIR}/piscina-azotea.jpg`} alt={altFor("piscina-azotea.jpg")} className="mt-12 h-72 w-full object-cover sm:h-[28rem]" />
          <ul className="mt-12 grid gap-x-10 gap-y-6 sm:grid-cols-3">
            {AMENITIES.map((a, i) => (
              <li key={a} className="border-t pt-5" style={{ borderColor: "rgba(217,199,160,.25)" }}>
                <span className="text-sm tracking-[0.2em]" style={{ color: SAND_LIGHT, fontFamily: serif }} aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="mt-2 block text-2xl font-light" style={{ fontFamily: serif }}>{a}</span>
              </li>
            ))}
          </ul>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${IMG_DIR}/lobby-lounge.jpg`} alt={altFor("lobby-lounge.jpg")} className="mt-14 h-72 w-full object-cover sm:h-96" />
        </div>
      </section>

      {/* -------------------------------------------- Rental management */}
      <section id="administracion" className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="grid gap-14 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className={EYEBROW} style={{ color: SAND }}>Programa de administración · Wello</p>
            <h2 className={H2} style={{ fontFamily: serif }}>Apoyo profesional para operar su residencia</h2>
            <p className="mt-8 text-lg leading-relaxed text-[#4F5A52]">
              Parkside presenta un programa de administración de alquileres asociado con Wello, diseñado
              para propietarios que desean apoyo profesional en la operación de su residencia.
            </p>
          </div>
          <div>
            <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {WELLO_SERVICES.map(t => (
                <li key={t} className="border-t pt-4 leading-relaxed" style={{ borderColor: "rgba(30,43,35,.14)" }}>{t}</li>
              ))}
            </ul>
            <p className="mt-8 text-xs leading-relaxed text-[#8A857A]">
              Las condiciones, costos, comisiones y restricciones del programa y del edificio se
              confirman con el desarrollador y en los contratos correspondientes. No se garantizan
              ingresos, ocupación ni rentabilidad.
            </p>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- Deposits */}
      <section id="depositos" className="py-20 sm:py-24" style={{ background: "#EDE7DA" }}>
        <div className="mx-auto max-w-6xl px-6">
          <p className={EYEBROW} style={{ color: GREEN }}>Estructura de depósitos</p>
          <h2 className={`${H2} max-w-3xl`} style={{ fontFamily: serif }}>
            Conozca cuánto capital necesitaría en cada etapa
          </h2>
          <div className="mt-12 grid items-start gap-12 lg:grid-cols-2">
            <ol className="grid grid-cols-2 gap-x-8 gap-y-10">
              {DEPOSITS.map((d, i) => (
                <li key={d.when} className="border-t pt-5" style={{ borderColor: "rgba(30,43,35,.2)" }}>
                  <p className={`${EYEBROW} text-[#6B7068]`}>Etapa {i + 1}</p>
                  <p className="mt-3 text-5xl font-light" style={{ fontFamily: serif, color: GREEN }}>{d.pct}%</p>
                  <p className="mt-3 text-sm leading-relaxed text-[#4F5A52]">{d.when}</p>
                </li>
              ))}
            </ol>
            <DepositCalculator stages={DEPOSITS} />
          </div>
          <p className="mt-8 text-xs leading-relaxed text-[#8A857A]">
            Calendario anunciado por el desarrollador, sujeto a la documentación comercial vigente.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------- Why Catherine */}
      <section id="asesoria" className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <p className={EYEBROW} style={{ color: SAND }}>Su asesoría</p>
        <h2 className={`${H2} max-w-3xl`} style={{ fontFamily: serif }}>
          ¿Por qué invertir con la asesoría de Catherine Gomez?
        </h2>
        <div className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2">
          {WHY_CATHERINE.map(([t, b]) => (
            <div key={t} className="border-t pt-6" style={{ borderColor: "rgba(30,43,35,.14)" }}>
              <h3 className="text-2xl font-light" style={{ fontFamily: serif }}>{t}</h3>
              <p className="mt-3 leading-relaxed text-[#4F5A52]">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------ Gallery */}
      {gallery.length > 0 && (
        <section id="galeria" className="pb-20 sm:pb-24">
          <div className="mx-auto max-w-6xl px-6">
            <p className={EYEBROW} style={{ color: SAND }}>Galería</p>
            <h2 className={H2} style={{ fontFamily: serif }}>Así se proyecta Parkside</h2>
            <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {gallery.map(src => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src} src={src} alt={altFor(src)} loading="lazy" className="h-72 w-full object-cover" />
              ))}
            </div>
            <p className="mt-6 text-xs text-[#8A857A]">
              Imágenes conceptuales del desarrollador. Acabados, mobiliario y vistas pueden variar.
            </p>
          </div>
        </section>
      )}

      {/* ------------------------------------------------- Lead form */}
      <section id="analisis" className="py-20 text-white sm:py-24" style={{ background: GREEN }}>
        <div className="mx-auto grid max-w-6xl gap-14 px-6 lg:grid-cols-[1fr_1.25fr]">
          <div>
            <p className={EYEBROW} style={{ color: SAND_LIGHT }}>Análisis personalizado</p>
            <h2 className={H2} style={{ fontFamily: serif }}>Antes de invertir en Brickell, conozca sus números</h2>
            <p className="mt-8 text-lg leading-relaxed text-white/70">
              Conozca el proyecto, evalúe sus costos y descubra si Parkside se ajusta a sus objetivos.
              Responda unas preguntas y le preparamos un análisis con:
            </p>
            <ul className="mt-8 space-y-4 text-white/75">
              {[
                "Precios vigentes y planos de las residencias disponibles",
                "El calendario de depósitos aplicado a su presupuesto",
                "Los gastos a considerar además del precio",
                "Cómo comprar desde Colombia, paso a paso",
              ].map(t => (
                <li key={t} className="flex gap-4">
                  <span className="mt-3 h-px w-5 shrink-0" style={{ background: SAND_LIGHT }} aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-10 space-y-1 text-sm text-white/55">
              <p className="font-medium text-white/80">Catherine Gomez Realtors Group</p>
              <p>Teléfono / WhatsApp: <a href={waUrl} className="underline">305.283.0872</a></p>
              <p>Correo: <a href="mailto:info@catherinegomezrealtor.com" className="underline">info@catherinegomezrealtor.com</a></p>
            </div>
          </div>
          <div className="relative text-[#1E2B23]">
            <LeadForm waUrl={waUrl} />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- FAQ */}
      <section id="preguntas" className="mx-auto max-w-4xl px-6 py-20 sm:py-24">
        <p className={EYEBROW} style={{ color: SAND }}>Preguntas frecuentes</p>
        <h2 className={H2} style={{ fontFamily: serif }}>Lo que los inversionistas preguntan primero</h2>
        <div className="mt-12">
          {FAQS.map(f => (
            <details key={f.q} className="group border-t py-6" style={{ borderColor: "rgba(30,43,35,.14)" }}>
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-left">
                <h3 className="text-xl font-light leading-snug" style={{ fontFamily: serif }}>{f.q}</h3>
                <span className="mt-1 shrink-0 text-lg font-light transition group-open:rotate-45" style={{ color: SAND }} aria-hidden="true">+</span>
              </summary>
              <p className="mt-4 max-w-3xl leading-relaxed text-[#4F5A52]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------- Closing CTA */}
      <section className="py-20 text-center text-white sm:py-24" style={{ background: FOREST }}>
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-[2.1rem] font-light leading-[1.12] sm:text-[3rem]" style={{ fontFamily: serif }}>
            Decida con información, no con prisa
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-white/60">
            Solicite una asesoría personalizada con Catherine Gomez y reciba el análisis de Parkside
            para su caso.
          </p>
          <div className="mt-11 flex flex-wrap justify-center gap-4">
            <a href="#analisis" className={btnPrimary} style={{ background: SAND, color: FOREST }}>
              Solicitar mi análisis personalizado
            </a>
            <a href={waUrl} className={btnGhost} style={{ borderColor: "rgba(255,255,255,.35)" }}>WhatsApp</a>
          </div>
        </div>
      </section>

      <footer className="py-12 text-center text-sm" style={{ background: FOREST, color: "rgba(255,255,255,.45)" }}>
        <p className={EYEBROW}>Catherine Gomez Realtors Group · Miami, Florida</p>
        <p className="mx-auto mt-5 max-w-3xl px-6 text-xs leading-relaxed text-white/30">
          Parkside Residences at Brickell es un proyecto de BI Group USA. Las imágenes son
          representaciones artísticas conceptuales y pueden cambiar sin previo aviso. Precios,
          disponibilidad, planos, amenidades, incentivos, fechas y condiciones están sujetos a cambio
          sin previo aviso y se confirman por escrito en la documentación del desarrollador. Las
          representaciones orales no pueden considerarse como declaraciones correctas del
          desarrollador; para las declaraciones correctas, consulte el folleto y los documentos
          requeridos por la sección 718.503 de los Estatutos de Florida que el desarrollador debe
          entregar al comprador. Esta página no constituye una oferta de venta ni asesoría
          financiera, legal o tributaria.
        </p>
      </footer>
    </main>
  )
}
