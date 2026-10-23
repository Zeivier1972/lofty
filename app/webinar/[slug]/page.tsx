import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { RegisterForm } from "./register-form"
import { findProject } from "@/lib/investment-projects"

export const dynamic = "force-dynamic"

const BASE = "https://www.catherinegomezrealtor.com"
const OG_FALLBACK = `${BASE}/og-webinar.jpg`
const PHONE_DISPLAY = "305.283.0872"
const PHONE_E164 = "+13052830872"

/* ------------------------------------------------------------------ data --- */

async function getWebinar(slug: string) {
  return prisma.webinar.findUnique({
    where: { slug },
    select: {
      slug: true, series: true, title: true, description: true, startsAt: true,
      durationMins: true, timezone: true, language: true, status: true,
      zoomJoinUrl: true, replayUrl: true, coverImageUrl: true, projectSlug: true,
    },
  })
}

/**
 * The audience is split between Miami and Colombia, which are not always the
 * same offset — Colombia does not observe DST, so the gap between them is one
 * hour for part of the year and zero for the rest. Showing one time and hoping
 * is how people miss a webinar, so both are rendered.
 */
function timesFor(startsAt: Date, tz: string) {
  const fmt = (timeZone: string) =>
    new Intl.DateTimeFormat("es-US", {
      timeZone, weekday: "long", day: "numeric", month: "long",
      hour: "numeric", minute: "2-digit", hour12: true,
    }).format(startsAt)

  const local = fmt(tz)
  const bogota = fmt("America/Bogota")
  // Only worth showing twice when they actually differ.
  const sameClock =
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(startsAt) ===
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" }).format(startsAt)

  return { local, bogota, sameClock }
}

/* -------------------------------------------------------------- metadata --- */

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const w = await getWebinar(params.slug)
  if (!w) return { title: "Webinar no encontrado | Catherine Gomez Realtor" }

  const pageUrl = `${BASE}/webinar/${w.slug}`
  const when = new Intl.DateTimeFormat("es-US", {
    timeZone: w.timezone, day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true,
  }).format(w.startsAt)

  const title = `${w.title} | Webinar gratis con Catherine Gomez`
  const description = `${w.description} Webinar en vivo y gratuito, ${when} (hora de Miami). Cupos limitados — reserva tu lugar.`.slice(0, 300)
  const image = w.coverImageUrl || findProject(w.projectSlug)?.og || OG_FALLBACK

  return {
    title,
    description,
    keywords: [
      "webinar inversión Miami",
      "invertir en Miami desde Colombia",
      "webinar bienes raíces Miami gratis",
      "pre-construcción Miami inversión",
      "comprar propiedad en Miami siendo extranjero",
      "renta corta Airbnb Miami inversión",
      "asesoría inmobiliaria Miami en español",
      w.title,
    ],
    alternates: { canonical: pageUrl },
    openGraph: {
      title,
      description,
      url: pageUrl,
      type: "website",
      siteName: "Catherine Gomez Realtor",
      locale: w.language === "en" ? "en_US" : "es_US",
      images: [{ url: image, width: 1200, height: 630, alt: `${w.title} — webinar de inversión en Miami` }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  }
}

/* ------------------------------------------------------------------- faq --- */

/**
 * Visible Q&A, mirrored into FAQPage JSON-LD. This is the part answer engines
 * quote, so the answers are written to stand alone — someone reading the answer
 * in an AI overview, with no page around it, should still get a straight reply.
 */
function faqsFor(w: { title: string; durationMins: number }) {
  return [
    {
      q: "¿El webinar tiene costo?",
      a: "No. Es gratuito y en vivo. Solo necesitas registrarte con tu correo para recibir el enlace de Zoom.",
    },
    {
      q: "¿Necesito tener residencia o visa americana para invertir en Miami?",
      a: "No. Un extranjero puede comprar propiedad en Florida sin residencia ni visa. Se necesita pasaporte, un ITIN para temas fiscales y, si se financia, un préstamo para extranjeros, que normalmente pide entre 30% y 40% de enganche. En el webinar se explica el proceso completo paso a paso.",
    },
    {
      q: "¿Puedo ver la grabación si no puedo asistir en vivo?",
      a: "Sí. Regístrate igual y te enviamos la grabación por correo al día siguiente. Aun así conviene asistir en vivo, porque la sesión de preguntas no queda en la grabación.",
    },
    {
      q: `¿Cuánto dura?`,
      a: `Alrededor de ${w.durationMins} minutos: la presentación del proyecto con los números, y después preguntas abiertas.`,
    },
    {
      q: "¿Me van a llamar para venderme algo?",
      a: "El webinar es informativo. Si al final quieres hablar de un proyecto en concreto puedes agendar una llamada uno a uno con Catherine; si no, no pasa nada.",
    },
    {
      q: "¿En qué idioma es?",
      a: "En español.",
    },
  ]
}

/* ------------------------------------------------------------------ page --- */

export default async function WebinarPage({ params }: { params: { slug: string } }) {
  const w = await getWebinar(params.slug)
  if (!w) notFound()

  const pageUrl = `${BASE}/webinar/${w.slug}`
  const { local, bogota, sameClock } = timesFor(w.startsAt, w.timezone)
  const faqs = faqsFor(w)
  const project = findProject(w.projectSlug)
  // The project's own photography is a far better cover than a generic card,
  // and it is already on disk under /public/inversion.
  const cover = w.coverImageUrl || project?.hero || null
  const isPast = w.status === "ENDED" || w.startsAt.getTime() < Date.now()
  const endsAt = new Date(w.startsAt.getTime() + w.durationMins * 60000)

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Event",
        name: w.title,
        description: w.description,
        startDate: w.startsAt.toISOString(),
        endDate: endsAt.toISOString(),
        eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
        eventStatus: w.status === "CANCELLED"
          ? "https://schema.org/EventCancelled"
          : "https://schema.org/EventScheduled",
        inLanguage: w.language === "en" ? "en" : "es",
        url: pageUrl,
        location: { "@type": "VirtualLocation", url: pageUrl },
        image: [w.coverImageUrl || OG_FALLBACK],
        offers: {
          "@type": "Offer",
          price: 0,
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
          url: pageUrl,
          validFrom: new Date().toISOString(),
        },
        organizer: { "@type": "RealEstateAgent", name: "Catherine Gomez Realtor", url: BASE, telephone: PHONE_E164 },
        performer: { "@type": "Person", name: "Catherine Gomez" },
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map(f => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="mx-auto max-w-5xl px-4 py-10 sm:py-16">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-5">
          {/* ── Pitch ── */}
          <div className="lg:col-span-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
              Webinar en vivo · Gratis
            </p>
            <h1 className="mt-3 text-3xl font-black leading-tight text-slate-900 sm:text-4xl">
              {w.title}
            </h1>

            {cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover}
                alt={project ? `${project.name} — el proyecto del webinar` : w.title}
                className="mt-5 aspect-[16/9] w-full rounded-2xl border border-slate-200 object-cover"
                loading="eager"
              />
            )}

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold capitalize text-slate-900">{local}</p>
              <p className="text-xs text-slate-500">hora de Miami</p>
              {!sameClock && (
                <>
                  <p className="mt-2 text-sm font-semibold capitalize text-slate-900">{bogota}</p>
                  <p className="text-xs text-slate-500">hora de Colombia</p>
                </>
              )}
              <p className="mt-2 text-xs text-slate-500">Duración: ~{w.durationMins} minutos · por Zoom</p>
            </div>

            <p className="mt-6 text-base leading-relaxed text-slate-700">{w.description}</p>

            {project && (
              <p className="mt-4 text-sm">
                <Link href={`/inversion/${project.slug}`} className="font-semibold text-sky-700 underline">
                  Ver los números de {project.name.split(" — ")[0]} antes del webinar →
                </Link>
              </p>
            )}

            <h2 className="mt-10 text-xl font-bold text-slate-900">Qué vas a ver</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li>• El proyecto completo: ubicación, precios por unidad y plan de pagos.</li>
              <li>• Los números reales de inversión — renta estimada, gastos, y el retorno después de gastos, no antes.</li>
              <li>• Cómo compra un extranjero en Florida: pasaporte, ITIN, financiamiento y cierre.</li>
              <li>• Preguntas abiertas al final, en vivo.</li>
            </ul>
          </div>

          {/* ── Signup ── */}
          <aside className="lg:col-span-2">
            <div className="sticky top-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              {isPast ? (
                <div className="text-center">
                  <h2 className="text-lg font-bold text-slate-900">Este webinar ya pasó</h2>
                  {w.replayUrl ? (
                    <>
                      <p className="mt-2 text-sm text-slate-600">La grabación está disponible.</p>
                      <Link
                        href={`/webinar/${w.slug}/replay`}
                        className="mt-4 inline-block rounded-xl bg-sky-700 px-6 py-3 font-semibold text-white hover:bg-sky-800"
                      >
                        Ver la grabación →
                      </Link>
                    </>
                  ) : (
                    <>
                      <p className="mt-2 text-sm text-slate-600">
                        Déjanos tu correo y te avisamos del próximo, con la grabación de este.
                      </p>
                      <div className="mt-4 text-left">
                        <RegisterForm slug={w.slug} joinUrlKnown={false} />
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <h2 className="text-lg font-bold text-slate-900">Reserva tu lugar</h2>
                  <p className="mb-4 mt-1 text-sm text-slate-600">
                    Gratis. Te enviamos el enlace y dos recordatorios.
                  </p>
                  <RegisterForm slug={w.slug} joinUrlKnown={!!w.zoomJoinUrl} />
                </>
              )}
            </div>
          </aside>
        </div>

        {/* ── FAQ ── */}
        <section className="mt-16" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="text-2xl font-bold text-slate-900">
            Preguntas frecuentes
          </h2>
          <dl className="mt-5 space-y-5">
            {faqs.map(f => (
              <div key={f.q} className="rounded-2xl border border-slate-200 bg-white p-5">
                <dt className="font-semibold text-slate-900">{f.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-slate-700">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <footer className="mt-14 border-t border-slate-200 pt-7 text-sm text-slate-600">
          <p className="font-bold text-slate-900">Catherine Gomez, Realtor</p>
          <p className="mt-1">
            <a href={`tel:${PHONE_E164}`} className="hover:text-sky-700">{PHONE_DISPLAY}</a>
            {" · "}
            <Link href="/" className="hover:text-sky-700">catherinegomezrealtor.com</Link>
          </p>
        </footer>
      </div>
    </main>
  )
}
