"use client"

/**
 * "Probar Sofía en YouTube" on Social → Accounts: runs the comment job in
 * preview mode (POST /api/youtube-comments/test) and shows, for the channel's
 * comments of the last 30 days, what Sofía would answer — nothing is posted.
 */

import { useState } from "react"
import { Loader2, Youtube, CheckCircle2, AlertCircle } from "lucide-react"

type Item = { author: string; comment: string; video: string; link: string; action: "reply" | "skip"; reason?: string; reply?: string }
type Result = { checked: number; replied: number; skipped: number; error?: string; channel?: string; canReply?: boolean; videos?: number; commentsClosed?: number; preview?: Item[] }

const ERRORS: Record<string, string> = {
  "YouTube not connected": "YouTube no está conectado. Haz clic en “Connect” en la tarjeta de YouTube de arriba.",
}

export default function YouTubeCommentTest() {
  const [busy, setBusy] = useState(false)
  const [r, setR] = useState<Result | null>(null)
  const [vBusy, setVBusy] = useState(false)
  const [vMsg, setVMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [confirming, setConfirming] = useState(false)

  async function testVideo() {
    setConfirming(false)
    setVBusy(true)
    setVMsg(null)
    try {
      const res = await fetch("/api/social/youtube-test-video", { method: "POST" })
      const d = await res.json()
      setVMsg(res.ok
        ? { ok: true, text: "Video en preparación. HeyGen tarda unos 10–20 minutos; luego se sube a YouTube como oculto y lo verás en la pestaña de publicaciones con su enlace." }
        : { ok: false, text: d.error || "No se pudo crear el video" })
    } catch {
      setVMsg({ ok: false, text: "No hubo respuesta del servidor" })
    } finally {
      setVBusy(false)
    }
  }

  async function run() {
    setBusy(true)
    setR(null)
    try {
      const res = await fetch("/api/youtube-comments/test", { method: "POST" })
      setR(await res.json())
    } catch {
      setR({ checked: 0, replied: 0, skipped: 0, error: "No hubo respuesta del servidor" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-red-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-gray-900"><Youtube className="h-4 w-4 text-red-600" /> Sofía en los comentarios de YouTube</p>
          <p className="mt-0.5 text-xs text-gray-500">Prueba sin publicar nada: lee los comentarios de los últimos 30 días y te muestra qué respondería.</p>
        </div>
        <button onClick={run} disabled={busy} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Probando…</> : "Probar Sofía en YouTube"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">Video de prueba con tu avatar</p>
          <p className="mt-0.5 text-xs text-gray-500">Se sube como oculto: nadie lo ve sin el enlace. Úsalo para revisar avatar, voz, título y descripción.</p>
        </div>
        {confirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-600">Usa ~$1–2 de crédito de HeyGen.</span>
            <button onClick={testVideo} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Sí, crear video</button>
            <button onClick={() => setConfirming(false)} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
          </div>
        ) : (
          <button onClick={() => { setVMsg(null); setConfirming(true) }} disabled={vBusy} className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">
            {vBusy ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando…</> : "Crear video de prueba"}
          </button>
        )}
      </div>
      {vMsg && <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${vMsg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{vMsg.text}</p>}

      {r && (
        <div className="mt-4 space-y-3">
          {r.error ? (
            <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {ERRORS[r.error] || r.error}</p>
          ) : (
            <p className="text-sm text-gray-700">
              Canal <strong>{r.channel}</strong>: {r.checked} comentario{r.checked === 1 ? "" : "s"} revisado{r.checked === 1 ? "" : "s"} · {r.replied} respuesta{r.replied === 1 ? "" : "s"} de ejemplo
            </p>
          )}
          {!r.error && (r.commentsClosed || 0) > 0 && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {r.commentsClosed === r.videos
                ? `Tus ${r.videos} videos más recientes tienen los comentarios desactivados, así que nadie puede comentar. Actívalos en YouTube Studio → Configuración → Comunidad → Configuración predeterminada, y en cada video (Detalles → Comentarios).`
                : `${r.commentsClosed} de tus ${r.videos} videos más recientes tienen los comentarios desactivados; Sofía revisa los demás.`}
            </p>
          )}
          {r.canReply === false && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              Falta el permiso para responder. Haz clic en “Connect” en YouTube, inicia sesión con la cuenta del canal y acepta todos los permisos.
            </p>
          )}
          {r.canReply === true && (
            <p className="flex items-start gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> Sofía tiene permiso para responder. Revisa el canal cada 30 minutos.
            </p>
          )}
          {!r.error && (r.preview?.length || 0) === 0 && (
            <p className="text-sm text-gray-500">No hay comentarios en los últimos 30 días.</p>
          )}
          <ul className="space-y-2">
            {r.preview?.map((p, i) => (
              <li key={i} className="rounded-lg border border-gray-200 p-3 text-sm">
                <p className="text-xs text-gray-400">
                  {p.author}{p.video ? ` · ${p.video}` : ""} · <a href={p.link} target="_blank" rel="noopener noreferrer" className="underline">ver en YouTube</a>
                </p>
                <p className="mt-1 text-gray-800">“{p.comment}”</p>
                {p.action === "reply"
                  ? <p className="mt-2 rounded-md bg-blue-50 px-3 py-2 text-blue-900"><strong>Sofía respondería:</strong> {p.reply}</p>
                  : <p className="mt-2 text-xs text-gray-500">No respondería: {p.reason}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
