"use client"

/**
 * Sofía en Zoom — control panel. Sofía runs on a server (zoom-bot/, the
 * native Zoom Meeting SDK on Linux, a separate Railway service): Catherine
 * pastes the meeting link here, Sofía joins as a participant, answers the
 * chat with the project's real data and sends Catherine private notes for
 * what only she should answer. This page only starts/stops her and shows
 * what she is doing; it can be closed during the presentation.
 *
 * Replaces the browser (Web SDK) version, whose chat Zoom Workplace shows as
 * "[This is an encrypted message]".
 */

import { useCallback, useEffect, useState } from "react"

type Project = { href: string; name: string; place: string }
type QA = { name: string; question: string; answer: string; action: string }
type Status = {
  status: string
  detail?: string
  meetingNumber?: string
  project?: string
  attendees?: string[]
  questions?: number
  paused?: boolean
  qa?: QA[]
  events?: string[]
  error?: string
}

const BASE = "https://www.catherinegomezrealtor.com"

/** "https://us02web.zoom.us/j/84012345678?pwd=…" → "84012345678". */
function meetingNumberFrom(input: string): string {
  const m = input.match(/\/(?:j|w|s|wc\/join)\/(\d{9,12})/) || input.match(/(\d[\d\s-]{8,14}\d)/)
  return m ? m[1].replace(/\D/g, "") : ""
}

const LABEL: Record<string, string> = {
  idle: "Sin reunión",
  starting: "Iniciando…",
  authorizing: "Conectando con Zoom…",
  authorized: "Conectada con Zoom",
  joining: "Entrando a la reunión…",
  connecting: "Entrando a la reunión…",
  waiting_for_host: "Esperando a que inicies la reunión",
  waiting_room: "En la sala de espera — admítela",
  in_meeting: "En la reunión ✓",
  reconnecting: "Reconectando…",
  leaving: "Saliendo…",
  ended: "Terminada",
  failed: "Error",
}

export default function SofiaZoomClient({ projects, hostName }: { projects: Project[]; hostName: string }) {
  const [project, setProject] = useState(projects.find(p => p.href === "/parkside")?.href || projects[0]?.href || "")
  const [link, setLink] = useState("")
  const [passcode, setPasscode] = useState("")
  const [st, setSt] = useState<Status>({ status: "idle" })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const proj = projects.find(p => p.href === (st.project || project))
  const first = hostName.split(" ")[0] || "Catherine"
  const bookUrl = proj?.href === "/parkside" ? `${BASE}/parkside/colombia` : `${BASE}${proj?.href || "/book"}`
  const active = !["idle", "ended", "failed"].includes(st.status)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/zoom-sofia/bot", { cache: "no-store" })
      const data = (await res.json()) as Status
      if (!res.ok) setError(data.error || "No se pudo leer el estado de Sofía")
      else setSt(data)
    } catch {
      setError("No se pudo leer el estado de Sofía")
    }
  }, [])

  useEffect(() => {
    void refresh()
    const t = setInterval(refresh, 3000)
    return () => clearInterval(t)
  }, [refresh])

  async function call(body: Record<string, unknown>) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/zoom-sofia/bot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as Status
      if (!res.ok) setError(data.error || "Algo falló")
      else if (data.status) setSt(data)
    } catch {
      setError("No hubo respuesta del servidor")
    } finally {
      setBusy(false)
      void refresh()
    }
  }

  function join() {
    const meetingNumber = meetingNumberFrom(link)
    if (!meetingNumber) return setError("Pega el link de Zoom o escribe el número de la reunión.")
    const pwdFromLink = (() => { try { return new URL(link).searchParams.get("pwd") || "" } catch { return "" } })()
    const p = projects.find(x => x.href === project)
    void call({
      action: "join",
      meetingNumber,
      password: passcode.trim() || pwdFromLink,
      project,
      welcome: `¡Hola a todos! 👋 Soy Sofía, la asistente de ${first}. Mientras ella presenta ${p?.name || "el proyecto"}, escriban aquí sus preguntas (precios, forma de pago, financiamiento) y les respondo al instante.`,
    })
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-xl space-y-4">
        <section className="rounded-2xl bg-white p-6 shadow sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900">Sofía en Zoom</h1>
          <p className="mt-2 text-sm text-slate-600">
            Sofía entra a tu reunión desde nuestro servidor, responde las preguntas del chat con los datos del proyecto y te
            manda en privado las que debes responder tú. Tú presentas desde tu Zoom normal; puedes cerrar esta página.
          </p>

          <div className="mt-5 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3">
            <span className={`h-2.5 w-2.5 rounded-full ${st.status === "in_meeting" ? "bg-emerald-500" : st.status === "failed" ? "bg-red-500" : active ? "bg-amber-400" : "bg-slate-300"}`} />
            <p className="text-sm font-semibold text-slate-800">{LABEL[st.status] || st.status}</p>
            {st.detail && st.status === "failed" && <p className="text-xs text-red-600">({st.detail})</p>}
          </div>

          {!active && (
            <>
              <label className="mt-5 block text-sm font-medium text-slate-700">Proyecto que presentas
                <select value={project} onChange={e => setProject(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5">
                  {projects.map(p => <option key={p.href} value={p.href}>{p.name} — {p.place}</option>)}
                </select>
              </label>
              <label className="mt-4 block text-sm font-medium text-slate-700">Link de Zoom o número de reunión
                <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://zoom.us/j/84012345678?pwd=…" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
              </label>
              <label className="mt-4 block text-sm font-medium text-slate-700">Código de acceso (passcode), si el link no lo trae
                <input value={passcode} onChange={e => setPasscode(e.target.value)} placeholder="Ej. 123456" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
              </label>
              <button onClick={join} disabled={busy} className="mt-6 w-full rounded-xl bg-indigo-600 px-5 py-3.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                {busy ? "Enviando a Sofía…" : "Enviar a Sofía a la reunión"}
              </button>
              <ul className="mt-4 space-y-1 text-xs text-slate-500">
                <li>• Inicia tu reunión primero. Si tienes sala de espera, admite a “Sofía”.</li>
                <li>• Funciona en reuniones de Zoom (no en Zoom Webinars).</li>
                <li>• Tus propios mensajes no los responde; si le escriben en privado, responde en privado.</li>
              </ul>
            </>
          )}

          {active && (
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                onClick={() => call({ action: "pause", paused: !st.paused })}
                disabled={busy}
                className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${st.paused ? "bg-slate-200 text-slate-700" : "bg-emerald-600 text-white"}`}
              >
                {st.paused ? "En pausa — reanudar" : "Respondiendo ✓ (pausar)"}
              </button>
              <button
                onClick={() => call({ action: "say", text: `📅 ¿Quieren su plan personalizado y una reunión privada de 30 minutos con ${first}? Agenden aquí: ${bookUrl}` })}
                disabled={busy || st.status !== "in_meeting"}
                className="rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                Enviar link para agendar
              </button>
              <button
                onClick={() => call({ action: "leave" })}
                disabled={busy}
                className="col-span-2 rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white"
              >
                Sacar a Sofía y guardar en CASAi
              </button>
            </div>
          )}

          {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </section>

        {(st.qa?.length || 0) > 0 && (
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-sm font-bold text-slate-900">Preguntas ({st.questions}) · Asistentes ({st.attendees?.length || 0})</h2>
            <ul className="mt-3 space-y-2">
              {st.qa!.slice().reverse().map((q, i) => (
                <li key={i} className="rounded-lg border border-slate-200 p-2 text-xs">
                  <p className="text-slate-400">{q.name} · {q.action === "escalate" ? "para ti" : "respondida"}</p>
                  <p className="mt-1 font-medium text-slate-800">{q.question}</p>
                  {q.answer && <p className={`mt-1 ${q.action === "escalate" ? "text-amber-700" : "text-slate-600"}`}>{q.answer}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {(st.events?.length || 0) > 0 && (
          <details className="rounded-2xl bg-white p-6 shadow">
            <summary className="cursor-pointer text-sm font-bold text-slate-900">Registro técnico</summary>
            <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-[11px] text-slate-600">{st.events!.join("\n")}</pre>
          </details>
        )}
      </div>
    </main>
  )
}
