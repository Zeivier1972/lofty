import type { Metadata } from "next"
import BookingCalendar from "@/components/public/booking-calendar"
import { cormorantDisplay } from "@/app/fonts"

/**
 * /parkside/colombia/agendar — the 15-minute calendar on its own.
 *
 * On /parkside/colombia the calendar only appears after the plan quiz. The
 * Parkside smart plan's emails and texts link here so a lead who already did
 * the quiz (or came from WhatsApp) can book in one step. `?n=` prefills the
 * first name. Not indexed: it is a booking step, the page that ranks is
 * /parkside/colombia (canonical). Open Graph stays so the link previews well
 * when it is pasted in WhatsApp.
 */

const BASE = "https://www.catherinegomezrealtor.com"
const PAGE_URL = `${BASE}/parkside/colombia`
const FOREST = "#1E2B23"
const GREEN = "#2E4236"
const SAND = "#B59A6A"
const LINE = "rgba(46,66,54,.22)"
const serif = "var(--font-display), Georgia, serif"

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: "Agenda 15 minutos con Catherine Gomez — Parkside Residences at Brickell",
  description:
    "Una conversación de 15 minutos por Zoom o teléfono, en español y sin compromiso, para resolver tus dudas sobre invertir en Parkside Residences at Brickell desde Colombia.",
  alternates: { canonical: PAGE_URL },
  robots: { index: false, follow: true },
  openGraph: {
    title: "Hablemos 15 minutos, sin compromiso",
    description: "Agenda una conversación con Catherine Gomez sobre Parkside Residences at Brickell: proceso, visas, presupuesto y tus dudas.",
    url: `${PAGE_URL}/agendar`,
    type: "website",
    siteName: "Catherine Gomez Realtor",
    locale: "es_CO",
    images: [{ url: `${BASE}/parkside/fachada-atardecer.jpg`, width: 1200, height: 630, alt: "Parkside Residences at Brickell al atardecer, frente a Simpson Park en Miami" }],
  },
  twitter: { card: "summary_large_image", images: [`${BASE}/parkside/fachada-atardecer.jpg`] },
}

export default function AgendarParksidePage({ searchParams }: { searchParams: { n?: string } }) {
  const first = typeof searchParams?.n === "string"
    ? searchParams.n.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' -]/g, "").trim().slice(0, 40)
    : ""
  return (
    <main className={`${cormorantDisplay.variable} min-h-screen px-4 py-10`} style={{ background: "#F6F3EC", color: FOREST }}>
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: SAND }}>Parkside Residences at Brickell</p>
        <h1 className="mt-3 text-[2rem] font-light leading-tight sm:text-[2.6rem]" style={{ fontFamily: serif }}>
          {first ? `${first}, hablemos 15 minutos` : "Hablemos 15 minutos"}, sin compromiso
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[#4B4A44]">
          No es una presentación de ventas. Quiero conocerte y entender en qué punto estás: si apenas exploras, tienes dudas
          sobre el proceso o las visas, o quieres saber qué puedes comprar con tu presupuesto. Por Zoom o teléfono, en español.
        </p>
        <div className="mt-8">
          <BookingCalendar
            source="PARKSIDE"
            topic="Parkside — conversación de 15 minutos"
            durationMinutes={15}
            meetingWord="conversación"
            pageLabel="/parkside/colombia/agendar"
            prefill={first ? { firstName: first } : undefined}
            theme={{ accent: GREEN, accentText: "#fff", ink: FOREST, muted: "#6B6A62", surface: "#fff", line: LINE }}
            doneExtra={
              <a
                href="/guias/guia-comprador-colombiano-miami.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-block px-6 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-white"
                style={{ background: GREEN }}
              >
                Descargar la guía del comprador colombiano (PDF)
              </a>
            }
          />
        </div>
        <p className="mt-8 text-xs text-[#6B6A62]">
          Catherine Gomez, Realtor · Licencia de bienes raíces de Florida #3320405 · En la conversación no se pide dinero ni datos bancarios.
        </p>
      </div>
    </main>
  )
}
