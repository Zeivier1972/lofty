export const dynamic = "force-dynamic"

import { readdirSync } from "fs"
import { join } from "path"
import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { fetchPexelsRaw } from "@/lib/pexels-video"

// Official One Twenty Brickell renderings, if provided. Drop image files into
// public/guias/one-twenty-brickell/ and they're used automatically here.
function officialImages(): string[] {
  try {
    const dir = join(process.cwd(), "public", "guias", "one-twenty-brickell")
    return readdirSync(dir)
      .filter(f => /\.(jpe?g|png|webp|avif)$/i.test(f))
      .sort()
      .map(f => `/guias/one-twenty-brickell/${f}`)
  } catch {
    return []
  }
}

export const metadata: Metadata = {
  title: "Tu Kit de Inversión | One Twenty Brickell — Invertir en Miami desde Costa Rica",
  description:
    "Kit del inversionista: por qué invertir en Miami desde Costa Rica, One Twenty Brickell, financiamiento para extranjeros, rentabilidad y el proceso paso a paso.",
}

const BOOK_URL = "https://www.catherinegomezrealtor.com/book"
const PROJECTS_URL = "https://www.catherinegomezrealtor.com/new-construction"

// Reliable building/skyline fallbacks (used only when PEXELS_API_KEY isn't set).
// All are high-rise / skyline shots — no interiors, houses, or people.
const SKYLINE = "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1600&q=80"
const TOWERS = "https://images.unsplash.com/photo-1444723121867-7a241cacace9?w=1280&q=80"

export default async function CostaRicaGuidePage() {
  const config = await prisma.aIConfig.findFirst().catch(() => null)
  const bookUrl = config?.calendlyUrl || BOOK_URL
  const phone = config?.realtorPhone || ""
  const waDigits = phone.replace(/\D/g, "")
  const waUrl = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent("Hola Catherine, vi el Kit de One Twenty Brickell y quiero agendar una llamada para invertir en Miami desde Costa Rica.")}`
    : null

  const official = officialImages()

  // Building-only imagery: Brickell skyline + high-rise investment towers.
  const [heroImg, whyImg, towerImg, poolImg, keysImg] = await Promise.all([
    fetchPexelsRaw("Brickell Miami downtown skyline skyscrapers dusk").catch(() => null),
    fetchPexelsRaw("Miami high rise condominium towers aerial").catch(() => null),
    fetchPexelsRaw("modern glass residential skyscraper tower").catch(() => null),
    fetchPexelsRaw("luxury high rise apartment building exterior").catch(() => null),
    fetchPexelsRaw("Miami downtown skyscrapers blue glass facade").catch(() => null),
  ])
  // Prefer the real One Twenty Brickell renderings when provided:
  //   [0] exterior → showcase · [1] terrace/skyline → hero & CTA · rest → gallery
  const tower = official[0] || towerImg || TOWERS
  const hero = official[1] || heroImg || SKYLINE
  const gallery = official.length > 2 ? official.slice(2) : official.slice(1)
  const why = whyImg || TOWERS
  const pool = poolImg || TOWERS
  const keys = keysImg || SKYLINE
  const agent = config?.realtorName || "Catherine"

  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={hero} alt="Brickell, Miami" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#07162c]/90 via-[#0b1f3a]/75 to-[#0b1f3a]/40" />
        <div className="relative mx-auto max-w-6xl px-5 py-20 text-white">
          <p className="inline-block rounded-full bg-white/15 backdrop-blur px-4 py-1.5 text-sm font-semibold">
            🇨🇷 Inversionistas de Costa Rica · 🏙️ One Twenty Brickell
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl sm:text-6xl font-extrabold leading-tight">
            Tu Kit de Inversión en Miami
          </h1>
          <p className="mt-4 max-w-2xl text-xl text-blue-100 font-medium">
            Gracias por tu interés. Aquí está todo lo que necesitas saber para invertir en
            <strong> One Twenty Brickell</strong> desde Costa Rica — y el siguiente paso: una llamada conmigo.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={bookUrl} className="rounded-xl bg-white px-7 py-4 font-bold text-[#0b1f3a] hover:bg-blue-50 shadow-lg">
              📅 Agenda tu llamada gratis
            </a>
            {waUrl && (
              <a href={waUrl} className="rounded-xl bg-[#25D366] px-7 py-4 font-bold text-white hover:brightness-95 shadow-lg">
                💬 Escríbeme por WhatsApp
              </a>
            )}
            <a href={PROJECTS_URL} className="rounded-xl border border-white/40 px-7 py-4 font-bold text-white hover:bg-white/10">
              🏗️ Ver proyectos
            </a>
          </div>
        </div>
      </section>

      {/* What happens next */}
      <section className="bg-blue-50 border-b border-blue-100">
        <div className="mx-auto max-w-4xl px-5 py-8 text-center">
          <p className="text-lg text-[#0b1f3a]">
            ✅ <strong>Ya recibimos tus datos.</strong> En este Kit verás por qué Miami es una de las mejores
            inversiones para tu capital — y cuando estés listo, <strong>agenda una llamada</strong> y te muestro los
            números reales de One Twenty Brickell.
          </p>
        </div>
      </section>

      {/* Why Miami */}
      <section className="mx-auto max-w-6xl px-5 py-16 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <h2 className="text-3xl font-extrabold">¿Por qué invertir en Miami desde Costa Rica?</h2>
          <ul className="mt-6 space-y-4">
            {[
              ["💵", "Tu capital en dólares", "Protege tu patrimonio en USD, lejos de la devaluación y la inflación local."],
              ["📈", "Plusvalía comprobada", "Brickell se ha apreciado año tras año. Comprar en pre-construcción maximiza tu ganancia."],
              ["🏦", "Renta en un mercado fuerte", "Alta demanda de alquiler de ejecutivos en el distrito financiero de Miami."],
              ["✈️", "Cerca y conectado", "Vuelos directos desde San José, ciudad segura y con comunidad latina."],
            ].map(([icon, t, b]) => (
              <li key={t} className="flex gap-3">
                <span className="text-2xl">{icon}</span>
                <span><strong className="block">{t}</strong><span className="text-gray-600">{b}</span></span>
              </li>
            ))}
          </ul>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={why} alt="Invertir en Miami" className="rounded-2xl shadow-xl w-full h-80 object-cover" loading="lazy" />
      </section>

      {/* One Twenty Brickell */}
      <section className="bg-[#0b1f3a] text-white">
        <div className="mx-auto max-w-6xl px-5 py-16 grid lg:grid-cols-2 gap-10 items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={tower} alt="One Twenty Brickell" className="rounded-2xl shadow-xl w-full h-80 object-cover order-2 lg:order-1" loading="lazy" />
          <div className="order-1 lg:order-2">
            <h2 className="text-3xl font-extrabold">One Twenty Brickell Residences</h2>
            <p className="mt-3 text-blue-100">
              Pre-construcción en el corazón de Brickell — diseñada para vivir y para invertir, con amenidades de lujo y
              un plan de pagos cómodo durante la construcción.
            </p>
            <div className="mt-6 grid sm:grid-cols-2 gap-4">
              {[
                ["📍 Ubicación", "A pasos de bancos, restaurantes y Brickell City Centre."],
                ["🏊 Amenidades", "Piscina, gimnasio, coworking y seguridad 24/7."],
                ["💼 Ideal para rentar", "Inquilinos profesionales con alta demanda."],
                ["💳 Plan de pagos", "Pagas por etapas — no todo de una vez."],
              ].map(([t, b]) => (
                <div key={t} className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <div className="font-bold">{t}</div>
                  <div className="mt-1 text-sm text-blue-100/90">{b}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Official renderings gallery — shows only when images are provided */}
      {gallery.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pt-14">
          <h2 className="text-center text-2xl font-extrabold">Galería — One Twenty Brickell</h2>
          <p className="text-center text-sm text-gray-400 mt-1">Renderings conceptuales del artista</p>
          <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
            {gallery.map((src, i) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img key={src} src={src} alt={`One Twenty Brickell ${i + 1}`} className="rounded-xl shadow w-full h-52 object-cover" loading="lazy" />
            ))}
          </div>
        </section>
      )}

      {/* The numbers */}
      <section className="mx-auto max-w-6xl px-5 py-16 text-center">
        <h2 className="text-3xl font-extrabold">Los números que importan</h2>
        <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            ["30–40%", "Enganche para extranjeros"],
            ["100% USD", "Inversión en dólares"],
            ["Por etapas", "Plan de pagos en obra"],
            ["Brickell", "Distrito financiero #1"],
          ].map(([big, small]) => (
            <div key={small} className="rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="text-3xl font-extrabold text-[#12315c]">{big}</div>
              <div className="mt-1 text-sm text-gray-500">{small}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-gray-400">*Precios y planes sujetos a cambios del desarrollador. En la llamada te doy los números actualizados.</p>
      </section>

      {/* Financing + amenities images strip */}
      <section className="mx-auto max-w-6xl px-5 pb-4 grid sm:grid-cols-2 gap-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={pool} alt="Amenidades" className="rounded-2xl shadow w-full h-56 object-cover" loading="lazy" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={keys} alt="Financiamiento para extranjeros" className="rounded-2xl shadow w-full h-56 object-cover" loading="lazy" />
      </section>

      {/* Explore more projects */}
      <section className="mx-auto max-w-4xl px-5 py-12">
        <div className="rounded-2xl border-2 border-blue-100 bg-blue-50 p-8 text-center">
          <h2 className="text-2xl font-extrabold text-[#0b1f3a]">¿Quieres ver más proyectos?</h2>
          <p className="mt-2 text-gray-600">
            One Twenty Brickell es una de muchas oportunidades. Explora todos los proyectos de
            pre-construcción en Miami y el Sur de Florida — listados actualizados a diario.
          </p>
          <a href={PROJECTS_URL} className="mt-6 inline-block rounded-xl bg-[#12315c] px-7 py-4 font-bold text-white hover:bg-[#0b1f3a]">
            🏗️ Ver proyectos de pre-construcción →
          </a>
        </div>
      </section>

      {/* Process */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-3xl font-extrabold text-center">Cómo lo hacemos — paso a paso</h2>
        <div className="mt-10 grid md:grid-cols-4 gap-6">
          {[
            ["1", "Llamada estratégica", "Revisamos tu objetivo, presupuesto y los números reales."],
            ["2", "Elige tu unidad", "Te muestro las mejores opciones de vista y precio."],
            ["3", "Reserva", "Coordino contrato, abogado y depósito — todo en español."],
            ["4", "Financiamiento y cierre", "Te conecto con bancos para extranjeros y cerramos."],
          ].map(([n, t, b]) => (
            <div key={n} className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#12315c] text-white font-bold text-lg">{n}</div>
              <h3 className="mt-4 font-bold">{t}</h3>
              <p className="mt-2 text-gray-600 text-sm leading-relaxed">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA — schedule a call */}
      <section className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[#0b1f3a]/85" />
        <div className="relative mx-auto max-w-3xl px-5 py-20 text-center text-white">
          <h2 className="text-3xl sm:text-4xl font-extrabold">Agenda tu llamada con {agent}</h2>
          <p className="mt-3 text-blue-100">
            Sin compromiso. Te muestro los números de One Twenty Brickell y resolvemos todas tus dudas sobre invertir
            en Miami desde Costa Rica.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href={bookUrl} className="rounded-xl bg-white px-8 py-4 font-bold text-[#0b1f3a] hover:bg-blue-50 shadow-lg text-lg">
              📅 Agendar mi llamada
            </a>
            {waUrl && (
              <a href={waUrl} className="rounded-xl bg-[#25D366] px-8 py-4 font-bold text-white hover:brightness-95 shadow-lg text-lg">
                💬 WhatsApp
              </a>
            )}
            {phone && (
              <a href={`tel:${phone}`} className="rounded-xl border border-white/40 px-8 py-4 font-bold hover:bg-white/10 text-lg">
                📞 {phone}
              </a>
            )}
          </div>
        </div>
      </section>

      <footer className="bg-[#07162c] text-blue-200/70 text-center text-sm py-8 px-5">
        {agent} · Real Estate en Miami{phone ? ` · ${phone}` : ""}
        <div className="mt-1 text-blue-200/50">
          Información referencial, no es una oferta de valores. Sujeta a verificación con el desarrollador.
        </div>
      </footer>
    </main>
  )
}
