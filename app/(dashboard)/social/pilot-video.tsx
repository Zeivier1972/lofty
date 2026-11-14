"use client"

/**
 * "Video piloto 16:9" on Social → Accounts: the production plan for the
 * YouTube pilot, then each step behind Catherine's own click — approve the
 * plan (HeyGen renders), watch the edited video here, upload it unlisted,
 * publish. See lib/pilot-video.ts.
 */

import { useCallback, useEffect, useState } from "react"
import { Loader2, Clapperboard, ChevronDown, ChevronUp, ExternalLink, Download } from "lucide-react"

type Scene = { id: string; mode: string; narration: string; visual: string; source: string; camera: string; transition: string; onScreen: string; purpose: string }
type State = {
  stage: "plan" | "avatar" | "editing" | "review" | "uploaded" | "public" | "failed"
  updatedAt: string
  finalUrl?: string
  thumbUrl?: string
  timings?: { id: string; start: number; end: number }[]
  chapters?: { at: number; title: string }[]
  shots?: { scene: string; kind: string; seconds: number }[]
  duration?: number
  youtubeId?: string
  thumbnailSet?: boolean
  avatarUrl?: string
  error?: string
}
type Data = { state: State; plan: { scenes: Scene[]; meta: { title: string; thumbnail: string; pinnedComment: string; followUp: string; tags: string[] }; description: string } }

const ts = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`
const estimate = (text: string) => text.split(/\s+/).length / 2.6

const STEP: Record<State["stage"], string> = {
  plan: "Revisa el plan y apruébalo para crear el video.",
  avatar: "HeyGen está grabando tu avatar en 16:9 (10–20 minutos). Puedes cerrar esta página.",
  editing: "Editando: insertando los renders, el recorrido 3D y los gráficos donde los nombras (unos minutos).",
  review: "Listo para revisar. Míralo completo; nada se sube a YouTube sin tu clic.",
  uploaded: "Subido a YouTube como OCULTO. Revísalo allí y, si te gusta, publícalo.",
  public: "Publicado en tu canal.",
  failed: "Algo falló.",
}

export default function PilotVideo() {
  const [d, setD] = useState<Data | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/social/pilot", { cache: "no-store" })
      if (r.ok) setD(await r.json())
    } catch { /* keep last */ }
  }, [])

  useEffect(() => { load() }, [load])
  const stage = d?.state.stage
  useEffect(() => {
    if (stage !== "avatar" && stage !== "editing") return
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [stage, load])

  async function act(action: string) {
    setConfirm(null)
    setBusy(action)
    setErr(null)
    try {
      const r = await fetch("/api/social/pilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) })
      const j = await r.json()
      if (!r.ok) setErr(j.error || "No se pudo")
      await load()
    } catch {
      setErr("No hubo respuesta del servidor")
    } finally {
      setBusy(null)
    }
  }

  if (!d) return null
  const s = d.state
  const timing = (id: string) => s.timings?.find(t => t.id === id)
  let est = 0

  const Btn = ({ action, label, tone = "dark" }: { action: string; label: string; tone?: "dark" | "gold" | "light" }) => (
    <button
      onClick={() => setConfirm(action)}
      disabled={!!busy}
      className={
        tone === "gold" ? "rounded-lg bg-[#C5A059] px-4 py-2 text-sm font-semibold text-[#121212] hover:brightness-95 disabled:opacity-60"
        : tone === "light" ? "rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        : "rounded-lg bg-[#121212] px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
      }
    >
      {busy === action ? <Loader2 className="h-4 w-4 animate-spin" /> : label}
    </button>
  )

  const CONFIRM: Record<string, string> = {
    approve: "¿Aprobar el plan y crear el video? Usa créditos de HeyGen (un video de ~1:30 en 1080p).",
    upload: "¿Subir a YouTube como OCULTO? Solo lo ve quien tenga el enlace.",
    publish: "¿Publicar en tu canal? Pasará de oculto a público.",
    reedit: "¿Volver a editar con la misma grabación de HeyGen? No usa créditos.",
    reset: "¿Empezar de nuevo? Se borra el estado del piloto (el video de YouTube, si existe, no se toca).",
  }

  return (
    <div className="rounded-xl border border-[#C5A059]/40 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-gray-900"><Clapperboard className="h-4 w-4 text-[#C5A059]" /> Video piloto 16:9 para YouTube</p>
          <p className="mt-0.5 max-w-xl text-xs text-gray-500">{d.plan.meta.title}</p>
          <p className="mt-2 text-sm text-gray-700">{STEP[s.stage]}</p>
          {s.error && <p className="mt-1 text-sm text-red-600">{s.error}</p>}
          {err && <p className="mt-1 text-sm text-red-600">{err}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {s.stage === "plan" && <Btn action="approve" label="Aprobar plan y crear video" tone="gold" />}
          {(s.stage === "avatar" || s.stage === "editing") && <span className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> En proceso…</span>}
          {s.stage === "review" && <Btn action="upload" label="Subir a YouTube (oculto)" tone="gold" />}
          {s.stage === "uploaded" && <Btn action="publish" label="Publicar en el canal" tone="gold" />}
          {s.stage === "failed" && s.avatarUrl && <Btn action="reedit" label="Editar de nuevo" />}
          {(s.stage === "review" || s.stage === "failed") && <Btn action="reset" label="Empezar de nuevo" tone="light" />}
        </div>
      </div>

      {confirm && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <span>{CONFIRM[confirm]}</span>
          <button onClick={() => act(confirm)} className="rounded-md bg-[#121212] px-3 py-1.5 font-semibold text-white">Sí</button>
          <button onClick={() => setConfirm(null)} className="rounded-md border border-amber-300 px-3 py-1.5">Cancelar</button>
        </div>
      )}

      {s.finalUrl && (s.stage === "review" || s.stage === "uploaded" || s.stage === "public") && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <video src={s.finalUrl} controls preload="metadata" poster={s.thumbUrl} className="w-full rounded-lg bg-black" />
          <div className="space-y-3 text-sm">
            {s.thumbUrl && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Miniatura</p>
                <img src={s.thumbUrl} alt="Miniatura del video piloto" className="w-full rounded-md" />
                <a href={s.thumbUrl} download className="mt-1 inline-flex items-center gap-1 text-xs text-gray-600 hover:underline"><Download className="h-3 w-3" /> Descargar</a>
                {s.stage !== "review" && !s.thumbnailSet && <p className="text-xs text-amber-700">YouTube no aceptó la miniatura por API (requiere canal verificado): súbela a mano en YouTube Studio.</p>}
              </div>
            )}
            {s.youtubeId && (
              <a href={`https://youtu.be/${s.youtubeId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-red-600 hover:underline">
                Ver en YouTube <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <p className="text-xs text-gray-500">Duración {ts(s.duration || 0)} · {s.shots?.length || 0} planos · 1920×1080</p>
          </div>
        </div>
      )}

      <button onClick={() => setOpen(o => !o)} className="mt-4 flex items-center gap-1 text-sm font-semibold text-gray-800">
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />} Plan de producción ({d.plan.scenes.length} escenas)
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="border-b text-gray-500">
                <tr>
                  <th className="py-2 pr-3">Tiempo</th><th className="pr-3">Narración</th><th className="pr-3">Visual</th><th className="pr-3">Fuente</th>
                  <th className="pr-3">Cámara</th><th className="pr-3">Transición</th><th className="pr-3">Texto en pantalla</th><th>Propósito</th>
                </tr>
              </thead>
              <tbody>
                {d.plan.scenes.map(sc => {
                  const t = timing(sc.id)
                  const start = t ? t.start : est
                  const end = t ? t.end : (est += estimate(sc.narration))
                  return (
                    <tr key={sc.id} className="border-b align-top">
                      <td className="whitespace-nowrap py-2 pr-3 text-gray-500">{t ? "" : "≈"}{ts(start)}–{ts(end)}</td>
                      <td className="pr-3 text-gray-900">{sc.narration}</td>
                      <td className="pr-3">{sc.visual}</td>
                      <td className="pr-3">{sc.source}</td>
                      <td className="pr-3">{sc.camera}</td>
                      <td className="pr-3">{sc.transition}</td>
                      <td className="pr-3">{sc.onScreen}</td>
                      <td>{sc.purpose}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!s.timings && <p className="mt-1 text-xs text-gray-400">≈ tiempos estimados; los exactos aparecen cuando el video está editado.</p>}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Descripción de YouTube</p>
              <pre className="mt-1 whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-xs text-gray-800">{d.plan.description}</pre>
            </div>
            <div className="space-y-3 text-xs text-gray-800">
              <div><p className="font-semibold uppercase tracking-wide text-gray-500">Miniatura</p><p className="mt-1">{d.plan.meta.thumbnail}</p></div>
              <div><p className="font-semibold uppercase tracking-wide text-gray-500">Comentario para fijar</p><p className="mt-1 whitespace-pre-wrap">{d.plan.meta.pinnedComment}</p><p className="mt-1 text-gray-500">YouTube no permite fijarlo por API: publícalo y fíjalo tú (tres puntos → Fijar).</p></div>
              <div><p className="font-semibold uppercase tracking-wide text-gray-500">Siguiente video sugerido</p><p className="mt-1">{d.plan.meta.followUp}</p></div>
              <div><p className="font-semibold uppercase tracking-wide text-gray-500">Etiquetas</p><p className="mt-1">{d.plan.meta.tags.join(", ")}</p></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
