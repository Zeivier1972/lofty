"use client"

import { useEffect, useRef, useState } from "react"
import BookingCalendar, { type CalendarPrefill } from "@/components/public/booking-calendar"

type Project = { name: string; place: string; href: string; img: string; alt: string; highlight: string; summary: string }

const NAVY = "#0c4a6e"
const SKY = "#0369a1"

export default function PersonalVideoClient({
  token, firstName, videoUrl, project, source, prefill,
}: {
  token: string
  firstName: string
  videoUrl: string | null
  project: Project | null
  source: string
  prefill: CalendarPrefill
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const sent = useRef<Set<number>>(new Set())
  const [started, setStarted] = useState(false)

  const report = (pct: number) => {
    if (sent.current.has(pct)) return
    sent.current.add(pct)
    fetch(`/api/v/${token}/view`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pct }),
      keepalive: true,
    }).catch(() => {})
  }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onTime = () => {
      if (!el.duration) return
      const p = (el.currentTime / el.duration) * 100
      for (const mark of [25, 50, 75, 100]) if (p >= mark - 1) report(mark)
    }
    const onPlay = () => { setStarted(true); report(0) }
    el.addEventListener("timeupdate", onTime)
    el.addEventListener("play", onPlay)
    return () => { el.removeEventListener("timeupdate", onTime); el.removeEventListener("play", onPlay) }
  })

  const about = project ? project.name : "tu inversión en Miami"

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Catherine Gomez · Realtor en Miami</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl" style={{ color: NAVY }}>
          {firstName}, este video es para ti
        </h1>
        <p className="mt-2 text-slate-600">Menos de un minuto sobre {about}.</p>

        <div className="mt-6 overflow-hidden rounded-2xl bg-black shadow-lg sm:mx-auto sm:max-w-sm">
          {videoUrl ? (
            <video
              ref={ref}
              src={videoUrl}
              controls
              playsInline
              preload="metadata"
              className="aspect-[9/16] w-full bg-black"
              aria-label={`Video de Catherine Gomez para ${firstName} sobre ${about}`}
            />
          ) : (
            <div className="flex aspect-[9/16] w-full items-center justify-center p-6 text-center text-sm text-slate-200">
              Tu video se está terminando de preparar. Vuelve a abrir este enlace en unos minutos.
            </div>
          )}
        </div>
        <p className="mt-2 text-center text-xs text-slate-500">
          Video creado con la imagen y la voz de Catherine con ayuda de inteligencia artificial.
        </p>

        {project && (
          <section className="mt-10 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={project.img} alt={project.alt} className="h-48 w-full object-cover sm:h-64" />
            <div className="p-5">
              <h2 className="text-xl font-bold" style={{ color: NAVY }}>{project.name}</h2>
              <p className="text-sm text-slate-500">{project.place} · {project.highlight}</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">{project.summary}</p>
              <a href={project.href} className="mt-4 inline-block text-sm font-semibold text-sky-700 hover:underline">
                Ver toda la información del proyecto →
              </a>
            </div>
          </section>
        )}

        <section id="agendar" className="mt-10 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <h2 className="text-2xl font-bold" style={{ color: NAVY }}>
            {started ? `${firstName}, ¿hablamos 15 minutos?` : "Hablemos, sin compromiso"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            15 minutos por Zoom o por teléfono para conocerte y resolver tus dudas: el proceso, visas, tu presupuesto o simplemente explorar. Tú decides el ritmo.
          </p>
          <div className="mt-6">
            <BookingCalendar
              source={source}
              topic={`Video personal — ${about}`}
              pageLabel={`/v/${project ? project.href.replace(/^\//, "") : "inversion"}`}
              theme={{ accent: SKY, accentText: "#fff", ink: NAVY, muted: "#64748b", surface: "#fff", line: "#e2e8f0" }}
              prefill={prefill}
              durationMinutes={15}
              meetingWord="conversación"
            />
          </div>
        </section>

        <footer className="mt-10 border-t border-slate-200 pt-5 text-center text-xs text-slate-500">
          Catherine Gomez, Realtor · Licencia de Florida #3320405 · 305-283-0872 ·{" "}
          <a href="/" className="underline">catherinegomezrealtor.com</a>
        </footer>
      </div>
    </main>
  )
}
