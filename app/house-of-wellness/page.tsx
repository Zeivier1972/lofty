export const dynamic = "force-dynamic"

import { readdirSync } from "fs"
import { join } from "path"
import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import BookingForm from "./booking-form"

const BASE = "https://www.catherinegomezrealtor.com"
const PAGE_URL = `${BASE}/house-of-wellness`
const IMG_DIR = "/house-of-wellness"
const OG_IMAGE = `${BASE}${IMG_DIR}/hero-brickell.jpg`

const TITLE =
  "House of Wellness Brickell — Apartamentos en Miami desde $419,900 | Catherine Gomez"
const DESCRIPTION =
  "House of Wellness Brickell: 34 pisos y 656 residencias en el corazón de Brickell, Miami, con más de 22,000 pies² de amenidades de bienestar. Estudios desde $419,900 USD y 10% al contrato. Agenda tu cita con Catherine Gomez, en español."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "House of Wellness Brickell",
    "House of Wellness Miami",
    "apartamentos en Brickell",
    "preconstrucción Miami",
    "comprar apartamento en Miami",
    "invertir en Miami",
    "condominios Brickell Miami",
    "North Development Miami",
    "apartamentos en venta Miami en español",
    "plan de pagos preconstrucción Miami",
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
      url: OG_IMAGE,
      width: 1200,
      height: 630,
      alt: "House of Wellness Brickell — terraza en la azotea con vista al skyline de Miami al atardecer",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
}

/**
 * Official renderings live in public/house-of-wellness/. Drop more files in
 * and they show up in the gallery automatically — no code change needed.
 */
function renderings(): string[] {
  try {
    return readdirSync(join(process.cwd(), "public", "house-of-wellness"))
      .filter(f => /\.(jpe?g|png|webp|avif)$/i.test(f))
      .sort()
      .map(f => `${IMG_DIR}/${f}`)
  } catch {
    return []
  }
}

const FEATURED: Record<string, string> = {
  hero: `${IMG_DIR}/hero-brickell.jpg`,
  fachada: `${IMG_DIR}/fachada.jpg`,
  gimnasio: `${IMG_DIR}/gimnasio.jpg`,
  cocina: `${IMG_DIR}/cocina.jpg`,
  recamara: `${IMG_DIR}/recamara-vista.jpg`,
}

/**
 * Real alt text per rendering, keyed by filename. A file without an entry still
 * gets a sensible generic description, so dropping new renderings in never
 * leaves an image undescribed.
 */
const GALLERY_ALT: Record<string, string> = {
  "balcon-bahia.jpg": "Balcón de una residencia de House of Wellness Brickell con sillón, mesa y vista abierta a la bahía de Biscayne y al skyline de Miami",
  "fachada-noche.jpg": "La torre House of Wellness iluminada de noche sobre 152 SW 9th Street, con sus balcones ajardinados y los arcos de la azotea",
  "torre-dia.jpg": "Vista diurna de la torre House of Wellness entre los edificios de Brickell, con vegetación en cada balcón",
  "recamara-closets.jpg": "Recámara de House of Wellness Brickell con clósets de madera integrados de piso a techo, cabecera tapizada y salida al balcón",
  "spa-piscina.jpg": "Terraza de spa de House of Wellness Brickell al atardecer, con piscina, jacuzzi, camastros y acceso al sauna",
}

const AMENITIES: { icon: string; title: string; body: string }[] = [
  { icon: "🏋️", title: "Gimnasio de última generación", body: "Equipo completo de fuerza y cardio, con entrenador personal disponible en el edificio." },
  { icon: "🧖", title: "Spa, sauna y hammam", body: "Circuito de spa completo para recuperarte sin salir de casa." },
  { icon: "❄️", title: "Cold plunge", body: "Baño de inmersión en frío, parte del circuito de recuperación y bienestar." },
  { icon: "🧘", title: "Yoga y meditación", body: "Estudios dedicados a yoga, respiración y meditación guiada." },
  { icon: "🏊", title: "Piscina en la azotea", body: "Piscina en el rooftop con solárium, cabañas y vista abierta a la bahía y al skyline." },
  { icon: "🥤", title: "Juice bar y nutrición", body: "Wellness bar con jugos, vitaminas IV y acompañamiento de nutricionista." },
]

const UNITS: { type: string; size: string; note: string }[] = [
  { type: "Estudio con balcón", size: "371 pies² (34 m²)", note: "La entrada al proyecto — desde $419,900 USD." },
  { type: "1 recámara", size: "Consultar plano disponible", note: "Ideal para rentar a ejecutivos de Brickell." },
  { type: "1 recámara · 1 baño", size: "Consultar plano disponible", note: "Distribución abierta con balcón." },
  { type: "2 recámaras", size: "620 pies² (58 m²)", note: "Para vivir, o para rentar con mayor ocupación." },
]

const PAYMENTS: { pct: string; when: string }[] = [
  { pct: "10%", when: "Al firmar el contrato — desde $41,990 USD" },
  { pct: "10%", when: "Durante 2026" },
  { pct: "10%", when: "Junio de 2027" },
  { pct: "10%", when: "Durante 2028" },
  { pct: "60%", when: "Al cierre, cuando se entrega el apartamento" },
]

// Visible Q&A. Answer engines (Google AI Overviews, ChatGPT, Perplexity) quote
// clear question → answer pairs, and it wins featured snippets. Mirrored below
// in the FAQPage JSON-LD.
const FAQS: { q: string; a: string }[] = [
  {
    q: "¿Dónde queda House of Wellness Brickell?",
    a: "En 152 SW 9th Street, Brickell, Miami, Florida — justo al lado de The Underline y a una cuadra de Brickell City Centre. Desde ahí tomas el tren que llega directo al aeropuerto de Miami.",
  },
  {
    q: "¿Cuánto cuesta un apartamento en House of Wellness?",
    a: "Los estudios comienzan en $419,900 USD. Los precios de 1 y 2 recámaras cambian según el piso, la vista y la disponibilidad del momento. Agenda una cita con Catherine Gomez y te envía la lista de precios vigente el mismo día.",
  },
  {
    q: "¿Cuál es el plan de pagos?",
    a: "10% al firmar el contrato (desde $41,990 USD), 10% durante 2026, 10% en junio de 2027, 10% durante 2028 y el 60% restante al cierre, cuando te entregan el apartamento. No pagas todo de una vez: pagas por etapas mientras se construye.",
  },
  {
    q: "¿Puedo comprar si no soy residente ni ciudadano de Estados Unidos?",
    a: "Sí. Un extranjero puede comprar propiedad en Miami a su nombre o a través de una empresa (LLC), sin necesidad de residencia ni de historial de crédito estadounidense. También existen préstamos para extranjeros (foreign national loans) con aproximadamente 30% a 40% de enganche.",
  },
  {
    q: "¿Puedo rentar mi apartamento por Airbnb?",
    a: "El edificio permite renta con un mínimo de 15 días. No hay programa de administración obligatorio: puedes rentar por tu cuenta, con quien tú elijas, o no rentar.",
  },
  {
    q: "¿Puedo vivir yo en el apartamento o quedarme cuando quiera?",
    a: "Sí. No hay límite de días para que el dueño se quede. Puedes vivir en él todo el año, usarlo cuando viajes a Miami, o rentarlo el resto del tiempo.",
  },
  {
    q: "¿Qué amenidades tiene el edificio?",
    a: "Más de 22,000 pies² dedicados a bienestar: gimnasio de última generación, spa con sauna y hammam, cold plunge, estudios de yoga y meditación, piscina en la azotea con vista a la bahía, juice bar con vitaminas IV, nutricionista y entrenador personal. También tiene administración on-site y cinco niveles de estacionamiento.",
  },
  {
    q: "¿Cuánto son los gastos mensuales?",
    a: "El HOA (mantenimiento) está estimado en $1.70 por pie² al mes y los impuestos de propiedad en aproximadamente 1.8% del valor al año. En un estudio de 371 pies², el HOA ronda los $630 mensuales. Catherine te arma el cálculo completo de tu unidad.",
  },
  {
    q: "¿Las unidades se entregan amuebladas?",
    a: "No. Las unidades no se entregan amuebladas. Catherine te puede conectar con proveedores de mobiliario en Miami si piensas rentar el apartamento apenas lo recibas.",
  },
  {
    q: "¿Cuándo se entrega el edificio?",
    a: "El desarrollador confirma la fecha de entrega vigente al momento de la reserva, y queda por escrito en tu contrato. Pregúntale a Catherine en tu cita y te da la fecha que el desarrollador tiene confirmada hoy.",
  },
  {
    q: "¿Quién construye House of Wellness?",
    a: "North Development, una alianza de Oak Capital y Edifica, con más de 40 años de trayectoria en desarrollo inmobiliario.",
  },
  {
    q: "¿Cómo agendo una cita con Catherine Gomez?",
    a: "Elige el día y la hora que te sirvan en el calendario de esta misma página. La cita queda confirmada de inmediato y recibes el correo de confirmación. Catherine te atiende en español o en inglés, por teléfono o por Zoom.",
  },
]

export default async function HouseOfWellnessPage() {
  const config = await prisma.aIConfig.findFirst().catch(() => null)
  const agentName = config?.realtorName || "Catherine Gomez"
  const phone = config?.realtorPhone || ""
  const waDigits = phone.replace(/\D/g, "")
  const waUrl = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(
        "Hola Catherine, vi la página de House of Wellness Brickell y quiero más información.",
      )}`
    : null

  const all = renderings()
  const featuredSet = new Set(Object.values(FEATURED))
  const gallery = all.filter(src => !featuredSet.has(src))
  const hero = all.includes(FEATURED.hero) ? FEATURED.hero : all[0]

  // Structured data — Google rich results and AI answer engines (AIO) read this.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "RealEstateAgent",
        "@id": `${BASE}#agent`,
        name: agentName,
        url: BASE,
        ...(phone ? { telephone: phone } : {}),
        areaServed: "Miami, Florida, USA",
        knowsLanguage: ["es", "en"],
      },
      {
        "@type": "Residence",
        name: "House of Wellness Brickell",
        url: PAGE_URL,
        image: all.map(src => `${BASE}${src}`),
        description: DESCRIPTION,
        numberOfRooms: 656,
        address: {
          "@type": "PostalAddress",
          streetAddress: "152 SW 9th Street",
          addressLocality: "Miami",
          addressRegion: "FL",
          postalCode: "33130",
          addressCountry: "US",
        },
        amenityFeature: AMENITIES.map(a => ({
          "@type": "LocationFeatureSpecification",
          name: a.title,
          value: true,
        })),
      },
      {
        "@type": "Offer",
        name: "House of Wellness Brickell — estudios",
        url: PAGE_URL,
        price: 419900,
        priceCurrency: "USD",
        availability: "https://schema.org/PreOrder",
        seller: { "@id": `${BASE}#agent` },
      },
      {
        "@type": "ItemList",
        name: "Tipos de residencia en House of Wellness Brickell",
        itemListElement: UNITS.map((u, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: u.type,
          description: `${u.size}. ${u.note}`,
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
    <main className="min-h-screen bg-stone-50 text-stone-900">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ---------------------------------------------------------- Hero */}
      <section className="relative flex min-h-[88vh] items-end">
        {hero && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hero}
            alt="House of Wellness Brickell: terraza en la azotea con piscina y vista al skyline de Miami al atardecer"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/95 via-stone-950/55 to-stone-950/30" />
        <div className="relative mx-auto w-full max-w-6xl px-5 pb-16 pt-28 text-white sm:pb-24">
          <p className="inline-block rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-[0.2em] backdrop-blur">
            BRICKELL · MIAMI, FLORIDA
          </p>
          <h1 className="mt-6 max-w-3xl text-4xl font-light leading-[1.1] sm:text-6xl">
            House of <span className="font-semibold">Wellness</span>
            <span className="mt-3 block text-lg font-normal text-emerald-200 sm:text-2xl">
              Un nuevo concepto residencial en Miami
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-stone-200">
            34 pisos y 656 residencias en el corazón de Brickell, con más de{" "}
            <strong className="text-white">22,000 pies² dedicados al bienestar</strong>:
            spa, gimnasio, yoga, cold plunge y piscina en la azotea.
          </p>

          <div className="mt-8 flex flex-wrap items-end gap-x-10 gap-y-5">
            <div>
              <p className="text-xs uppercase tracking-widest text-stone-300">Estudios desde</p>
              <p className="text-3xl font-semibold sm:text-4xl">$419,900 <span className="text-base font-normal text-stone-300">USD</span></p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-stone-300">10% al contrato, desde</p>
              <p className="text-3xl font-semibold sm:text-4xl">$41,990 <span className="text-base font-normal text-stone-300">USD</span></p>
            </div>
          </div>

          <div className="mt-9 flex flex-wrap gap-3">
            <a
              href="#agendar"
              className="rounded-xl bg-emerald-600 px-7 py-4 font-semibold text-white shadow-lg transition hover:bg-emerald-500"
            >
              Agendar cita con {agentName.split(" ")[0]}
            </a>
            {waUrl && (
              <a
                href={waUrl}
                className="rounded-xl bg-[#25D366] px-7 py-4 font-semibold text-white shadow-lg transition hover:brightness-95"
              >
                Escribir por WhatsApp
              </a>
            )}
            <a
              href="#residencias"
              className="rounded-xl border border-white/35 px-7 py-4 font-semibold text-white transition hover:bg-white/10"
            >
              Ver las residencias
            </a>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- Facts strip */}
      <section aria-label="Datos del proyecto" className="border-b border-stone-200 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-10 sm:grid-cols-4">
          {[
            ["34", "pisos"],
            ["656", "residencias"],
            ["22,000+", "pies² de bienestar"],
            ["5", "niveles de estacionamiento"],
          ].map(([n, l]) => (
            <div key={l} className="text-center">
              <p className="text-3xl font-semibold text-emerald-800">{n}</p>
              <p className="mt-1 text-sm text-stone-500">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------- The concept */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">El concepto</p>
            <h2 className="mt-4 text-3xl font-light leading-tight sm:text-4xl">
              No es un edificio con gimnasio.<br />
              <span className="font-semibold">Es un edificio construido alrededor de tu bienestar.</span>
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-stone-600">
              La mayoría de las torres de Brickell dedican un piso a las amenidades. House of
              Wellness dedica más de 22,000 pies² — un circuito completo de spa, movimiento,
              recuperación y nutrición que usas todos los días sin salir de tu casa.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-stone-600">
              Y está donde quieres estar: a una cuadra de Brickell City Centre, junto a
              The Underline, y sobre la línea de tren que te deja en el aeropuerto de Miami.
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={FEATURED.fachada}
            alt="Fachada iluminada de la torre House of Wellness en Brickell, Miami, con balcones ajardinados"
            className="w-full rounded-3xl object-cover shadow-xl"
          />
        </div>
      </section>

      {/* ---------------------------------------------------- Amenities */}
      <section id="amenidades" className="bg-emerald-950 py-20 text-white">
        <div className="mx-auto max-w-6xl px-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Amenidades</p>
          <h2 className="mt-4 max-w-2xl text-3xl font-light sm:text-4xl">
            Más de <span className="font-semibold">22,000 pies²</span> pensados para cómo quieres vivir
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {AMENITIES.map(a => (
              <div key={a.title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <p className="text-3xl" aria-hidden="true">{a.icon}</p>
                <h3 className="mt-4 text-lg font-semibold">{a.title}</h3>
                <p className="mt-2 leading-relaxed text-emerald-100/80">{a.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={FEATURED.gimnasio}
              alt="Gimnasio de House of Wellness Brickell con equipo de fuerza y cardio y ventanales de piso a techo"
              className="h-72 w-full rounded-2xl object-cover"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={FEATURED.cocina}
              alt="Cocina de una residencia de House of Wellness Brickell con acabados en madera clara y electrodomésticos integrados"
              className="h-72 w-full rounded-2xl object-cover"
            />
          </div>
        </div>
      </section>

      {/* --------------------------------------------------- Residences */}
      <section id="residencias" className="mx-auto max-w-6xl px-5 py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Las residencias</p>
        <h2 className="mt-4 text-3xl font-light sm:text-4xl">
          Desde estudios hasta <span className="font-semibold">2 recámaras</span>
        </h2>
        <div className="mt-10 grid items-start gap-10 lg:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
            <table className="w-full text-left">
              <caption className="sr-only">Tipos de residencia disponibles en House of Wellness Brickell</caption>
              <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                <tr>
                  <th scope="col" className="px-5 py-3">Tipo</th>
                  <th scope="col" className="px-5 py-3">Tamaño</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {UNITS.map(u => (
                  <tr key={u.type}>
                    <th scope="row" className="px-5 py-4 text-left align-top font-semibold text-stone-900">
                      {u.type}
                      <span className="mt-1 block text-sm font-normal text-stone-500">{u.note}</span>
                    </th>
                    <td className="whitespace-nowrap px-5 py-4 align-top text-stone-700">{u.size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-stone-100 bg-stone-50 px-5 py-4 text-sm text-stone-600">
              Los precios de 1 y 2 recámaras cambian según el piso, la vista y la disponibilidad.{" "}
              <a href="#agendar" className="font-semibold text-emerald-800 underline">
                Agenda tu cita
              </a>{" "}
              y {agentName.split(" ")[0]} te manda la lista vigente el mismo día. Las unidades no se
              entregan amuebladas.
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={FEATURED.recamara}
            alt="Recámara de una residencia de House of Wellness Brickell con clósets de madera integrados y ventanal con vista a la bahía"
            className="w-full rounded-2xl object-cover shadow-lg"
          />
        </div>
      </section>

      {/* ------------------------------------------------- Payment plan */}
      <section id="plan-de-pagos" className="border-y border-stone-200 bg-white py-20">
        <div className="mx-auto max-w-6xl px-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Plan de pagos</p>
          <h2 className="mt-4 text-3xl font-light sm:text-4xl">
            No pagas todo de una vez. <span className="font-semibold">Pagas mientras se construye.</span>
          </h2>
          <ol className="mt-10 grid gap-4 sm:grid-cols-5">
            {PAYMENTS.map((p, i) => (
              <li key={p.when} className="rounded-2xl border border-stone-200 p-5">
                <p className="text-xs font-semibold text-stone-400">Pago {i + 1}</p>
                <p className="mt-2 text-3xl font-semibold text-emerald-800">{p.pct}</p>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{p.when}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {[
              ["Renta mínima de 15 días", "Puedes rentar tu apartamento, sin programa de administración obligatorio."],
              ["Sin límite para el dueño", "Quédate los días que quieras, o vive ahí todo el año."],
              ["Gastos estimados", "HOA de $1.70 por pie² al mes e impuestos de aproximadamente 1.8% anual."],
            ].map(([t, b]) => (
              <div key={t} className="rounded-2xl bg-stone-50 p-6">
                <h3 className="font-semibold text-stone-900">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- Location */}
      <section id="ubicacion" className="mx-auto max-w-6xl px-5 py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Ubicación</p>
        <h2 className="mt-4 text-3xl font-light sm:text-4xl">
          152 SW 9th Street, <span className="font-semibold">Brickell</span>
        </h2>
        <div className="mt-10 grid gap-10 lg:grid-cols-2">
          <ul className="space-y-5">
            {[
              ["Junto a The Underline", "El parque lineal de Miami, con ciclovía y senderos, empieza en tu puerta."],
              ["A una cuadra de Brickell City Centre", "Tiendas, restaurantes y cine, caminando."],
              ["Tren directo al aeropuerto", "La estación del Metrorail te deja en el Aeropuerto Internacional de Miami sin cambiar de tren."],
              ["El distrito financiero de Miami", "Donde trabajan los inquilinos que rentan: banca, tecnología y fondos de inversión."],
            ].map(([t, b]) => (
              <li key={t} className="flex gap-4">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-600" aria-hidden="true" />
                <span>
                  <strong className="block text-stone-900">{t}</strong>
                  <span className="text-stone-600">{b}</span>
                </span>
              </li>
            ))}
          </ul>
          <iframe
            title="Mapa de la ubicación de House of Wellness en 152 SW 9th Street, Brickell, Miami"
            src="https://www.google.com/maps?q=152+SW+9th+St,+Miami,+FL+33130&output=embed"
            className="h-80 w-full rounded-2xl border border-stone-200"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </section>

      {/* ------------------------------------------------------ Gallery */}
      {gallery.length > 0 && (
        <section id="galeria" className="bg-white py-20">
          <div className="mx-auto max-w-6xl px-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Galería</p>
            <h2 className="mt-4 text-3xl font-light sm:text-4xl">Así se va a ver</h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {gallery.map(src => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt={GALLERY_ALT[src.split("/").pop() || ""] || "Render del proyecto House of Wellness Brickell en Miami"}
                  loading="lazy"
                  className="h-64 w-full rounded-2xl object-cover"
                />
              ))}
            </div>
            <p className="mt-6 text-xs text-stone-400">
              Imágenes conceptuales del desarrollador. Los acabados y las vistas pueden variar.
            </p>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------ Booking */}
      <section id="agendar" className="bg-emerald-950 py-20 text-white">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Tu cita</p>
              <h2 className="mt-4 text-3xl font-light leading-tight sm:text-4xl">
                Habla con <span className="font-semibold">{agentName}</span>
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-emerald-100/85">
                Elige el día y la hora que te sirvan. Tu cita queda confirmada al instante
                y te llega el correo de confirmación.
              </p>
              <ul className="mt-8 space-y-4 text-emerald-100/85">
                {[
                  "La lista de precios vigente y los planos disponibles",
                  "El cálculo real de tu pago inicial y de los gastos mensuales",
                  "Cómo comprar desde fuera de Estados Unidos, paso a paso",
                  "Qué unidades quedan y cuáles rentan mejor",
                ].map(t => (
                  <li key={t} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-8 text-sm text-emerald-200/70">
                Atención en español e inglés.{" "}
                {phone && <>También puedes llamar al <a href={`tel:${phone}`} className="underline">{phone}</a>.</>}
              </p>
            </div>
            <div className="text-stone-900">
              <BookingForm />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- FAQ */}
      <section id="preguntas" className="mx-auto max-w-4xl px-5 py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Preguntas frecuentes</p>
        <h2 className="mt-4 text-3xl font-light sm:text-4xl">
          Lo que todo el mundo <span className="font-semibold">pregunta primero</span>
        </h2>
        <div className="mt-10 divide-y divide-stone-200 border-y border-stone-200">
          {FAQS.map(f => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-semibold text-stone-900">
                <h3 className="text-base font-semibold">{f.q}</h3>
                <span className="shrink-0 text-xl text-emerald-700 transition group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="mt-3 leading-relaxed text-stone-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------- Closing CTA */}
      <section className="bg-stone-900 py-16 text-center text-white">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="text-3xl font-light sm:text-4xl">
            Los estudios empiezan en <span className="font-semibold">$419,900</span>
          </h2>
          <p className="mt-4 text-lg text-stone-300">
            Y la reserva, en $41,990. Agenda tu cita y {agentName.split(" ")[0]} te explica los números de tu caso.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="#agendar" className="rounded-xl bg-emerald-600 px-8 py-4 font-semibold transition hover:bg-emerald-500">
              Agendar mi cita
            </a>
            {waUrl && (
              <a href={waUrl} className="rounded-xl bg-[#25D366] px-8 py-4 font-semibold transition hover:brightness-95">
                WhatsApp
              </a>
            )}
          </div>
        </div>
      </section>

      <footer className="bg-stone-950 py-10 text-center text-sm text-stone-400">
        <p>{agentName} · Bienes raíces en Miami, Florida</p>
        <p className="mx-auto mt-3 max-w-2xl px-5 text-xs leading-relaxed text-stone-500">
          House of Wellness es un proyecto de North Development (Oak Capital + Edifica). Las imágenes
          son renders conceptuales del desarrollador. Precios, planos, amenidades y fechas están
          sujetos a cambio sin previo aviso y se confirman por escrito en el contrato de compraventa.
        </p>
      </footer>
    </main>
  )
}
