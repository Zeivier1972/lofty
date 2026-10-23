import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { RegisterForm } from "../register-form"
import { findProject } from "@/lib/investment-projects"

export const dynamic = "force-dynamic"

const BASE = "https://www.catherinegomezrealtor.com"
const OG_FALLBACK = `${BASE}/og-webinar.jpg`

/**
 * The replay. This is what turns one Thursday night into a lead magnet that
 * keeps working — it is the page that still brings registrations in March for
 * a webinar recorded in October.
 *
 * It is deliberately NOT gated behind a form. A gate captures a few more
 * emails, but it also hides the entire page from Google and from AI answer
 * engines, and this content — the real numbers on a Miami project, explained
 * in Spanish — is exactly what those engines are asked for. An indexed replay
 * that converts some visitors beats a gated one nobody finds. The capture
 * happens on the page instead: signup for the next session, and a direct line
 * to book a call.
 */

async function getWebinar(slug: string) {
  return prisma.webinar.findUnique({
    where: { slug },
    select: {
      slug: true, title: true, description: true, startsAt: true, language: true,
      replayUrl: true, replayPostedAt: true, coverImageUrl: true, projectSlug: true, series: true,
    },
  })
}

/** Turn a YouTube or Vimeo link into something embeddable; pass others through. */
function embedUrl(raw: string): { kind: "iframe" | "video"; src: string } {
  const yt = raw.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/)
  if (yt) return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${yt[1]}` }
  const vimeo = raw.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vimeo) return { kind: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}` }
  // A Zoom cloud-recording share link cannot be iframed (Zoom sends
  // X-Frame-Options), so anything unrecognised renders as a link-out below
  // rather than a blank box.
  if (/\.(mp4|webm|m4v)(\?|$)/i.test(raw)) return { kind: "video", src: raw }
  return { kind: "iframe", src: "" }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const w = await getWebinar(params.slug)
  if (!w) return { title: "Grabación no encontrada | Catherine Gomez Realtor" }

  const pageUrl = `${BASE}/webinar/${w.slug}/replay`
  const title = `${w.title} — grabación completa | Catherine Gomez`
  const description = `Grabación del webinar: ${w.description}`.slice(0, 300)
  const image = w.coverImageUrl || OG_FALLBACK

  return {
    title,
    description,
    keywords: [
      "grabación webinar inversión Miami",
      "invertir en Miami desde Colombia video",
      "webinar bienes raíces Miami en español",
      "cómo comprar en Miami siendo extranjero",
      w.title,
    ],
    alternates: { canonical: pageUrl },
    openGraph: {
      title, description, url: pageUrl, type: "video.other",
      siteName: "Catherine Gomez Realtor",
      locale: w.language === "en" ? "en_US" : "es_US",
      images: [{ url: image, width: 1200, height: 630, alt: `${w.title} — grabación del webinar` }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  }
}

export default async function ReplayPage({ params }: { params: { slug: string } }) {
  const w = await getWebinar(params.slug)
  if (!w) notFound()

  const pageUrl = `${BASE}/webinar/${w.slug}/replay`
  const embed = w.replayUrl ? embedUrl(w.replayUrl) : null

  // The next session in the same series, so the replay has somewhere to send
  // people who want it live.
  const next = w.series
    ? await prisma.webinar.findFirst({
        where: { series: w.series, startsAt: { gt: new Date() }, status: { not: "CANCELLED" } },
        orderBy: { startsAt: "asc" },
        select: { slug: true, title: true, startsAt: true, zoomJoinUrl: true },
      })
    : null

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: `${w.title} — grabación`,
    description: w.description,
    thumbnailUrl: [w.coverImageUrl || OG_FALLBACK],
    uploadDate: (w.replayPostedAt || w.startsAt).toISOString(),
    contentUrl: w.replayUrl || pageUrl,
    embedUrl: embed?.src || pageUrl,
    inLanguage: w.language === "en" ? "en" : "es",
    publisher: { "@type": "RealEstateAgent", name: "Catherine Gomez Realtor", url: BASE },
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700">Grabación del webinar</p>
        <h1 className="mt-3 text-3xl font-black leading-tight text-slate-900 sm:text-4xl">{w.title}</h1>
        <p className="mt-4 text-base leading-relaxed text-slate-700">{w.description}</p>

        {/* ── The recording ── */}
        <div className="mt-8">
          {!w.replayUrl ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
              <p className="font-semibold text-amber-900">La grabación se está procesando</p>
              <p className="mt-1 text-sm text-amber-800">
                Déjanos tu correo abajo y te la enviamos en cuanto esté lista.
              </p>
            </div>
          ) : embed && embed.kind === "iframe" && embed.src ? (
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-black pt-[56.25%]">
              <iframe
                src={embed.src}
                title={`${w.title} — grabación del webinar`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                allowFullScreen
                loading="lazy"
                className="absolute inset-0 h-full w-full"
              />
            </div>
          ) : embed && embed.kind === "video" ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              src={embed.src}
              controls
              preload="metadata"
              poster={w.coverImageUrl || undefined}
              className="w-full rounded-2xl border border-slate-200 bg-black"
            />
          ) : (
            <a
              href={w.replayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-2xl border border-sky-200 bg-sky-50 p-6 text-center font-semibold text-sky-800 hover:bg-sky-100"
            >
              Abrir la grabación →
            </a>
          )}
        </div>

        {findProject(w.projectSlug) && (
          <p className="mt-6 text-sm">
            <Link href={`/inversion/${findProject(w.projectSlug)!.slug}`} className="font-semibold text-sky-700 underline">
              Ver todos los números de este proyecto →
            </Link>
          </p>
        )}

        {/* ── Capture ── */}
        <section className="mt-12 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8" aria-labelledby="next-heading">
          {next ? (
            <>
              <h2 id="next-heading" className="text-xl font-bold text-slate-900">
                El próximo webinar es en vivo
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {next.title} —{" "}
                <span className="capitalize">
                  {new Intl.DateTimeFormat("es-US", {
                    timeZone: "America/New_York", weekday: "long", day: "numeric", month: "long",
                    hour: "numeric", minute: "2-digit", hour12: true,
                  }).format(next.startsAt)}
                </span>{" "}
                (hora de Miami). La sesión de preguntas no queda en la grabación, así que vale la pena en vivo.
              </p>
              <div className="mt-5 max-w-md">
                <RegisterForm slug={next.slug} joinUrlKnown={!!next.zoomJoinUrl} />
              </div>
            </>
          ) : (
            <>
              <h2 id="next-heading" className="text-xl font-bold text-slate-900">
                ¿Quieres hablar de números concretos?
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Déjanos tu correo y te avisamos del próximo webinar. O agenda una llamada directa si
                prefieres revisar tu caso uno a uno.
              </p>
              <div className="mt-5 max-w-md">
                <RegisterForm slug={w.slug} joinUrlKnown={false} />
              </div>
              <p className="mt-4 text-sm">
                <Link href="/book" className="font-semibold text-sky-700 underline">
                  Agendar una llamada con Catherine →
                </Link>
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
