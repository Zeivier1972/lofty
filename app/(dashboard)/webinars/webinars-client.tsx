"use client"

import { useEffect, useState } from "react"
import { Loader2, Video, Users, Link2, Plus, ExternalLink, AlertTriangle, Radio } from "lucide-react"
import { INVESTMENT_PROJECTS } from "@/lib/investment-projects"

type Webinar = {
  id: string
  slug: string
  series: string | null
  title: string
  description: string
  startsAt: string
  durationMins: number
  timezone: string
  status: string
  zoomJoinUrl: string | null
  zoomMeetingId: string | null
  replayUrl: string | null
  projectSlug: string | null
  coverImageUrl: string | null
  registrations: number
  attendedCount: number
  replayWatchedCount: number
}

const SITE = "https://www.catherinegomezrealtor.com"

const ZONE = "America/New_York"

/**
 * A `datetime-local` value is naive wall-clock time. Read it as Miami time and
 * return the matching UTC instant.
 *
 * Not a fixed offset: Miami is -04:00 under EDT and -05:00 under EST, so
 * hardcoding either one puts every webinar on the wrong side of the DST
 * change an hour out. Rendering the instant in the zone and measuring the gap
 * lets the browser apply whichever rule is right for that date.
 */
function toUtcIso(dt: string): string {
  const naive = new Date(`${dt}:00Z`)
  if (isNaN(naive.getTime())) return ""
  const inZone = new Date(naive.toLocaleString("en-US", { timeZone: ZONE }))
  const inUtc = new Date(naive.toLocaleString("en-US", { timeZone: "UTC" }))
  return new Date(naive.getTime() + (inUtc.getTime() - inZone.getTime())).toISOString()
}

const fmt = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("es-US", {
    timeZone: tz, weekday: "short", day: "numeric", month: "short",
    hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(iso))

export function WebinarsClient() {
  const [list, setList] = useState<Webinar[]>([])
  const [zoomOk, setZoomOk] = useState(true)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null)

  const [form, setForm] = useState({
    title: "", description: "", startsAt: "", durationMins: 60,
    series: "inversion-miami", projectSlug: "",
  })

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/webinars")
      const data = await res.json()
      if (res.ok) { setList(data.webinars || []); setZoomOk(!!data.zoomConfigured) }
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setMsg(null)
    try {
      const res = await fetch("/api/webinars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, startsAt: toUtcIso(form.startsAt), timezone: ZONE }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo crear")
      setMsg({ kind: "ok", text: `Creado. ${data.zoomNote || ""} Página: ${SITE}/webinar/${data.slug}` })
      setShowForm(false)
      setForm({ title: "", description: "", startsAt: "", durationMins: 60, series: "inversion-miami", projectSlug: "" })
      load()
    } catch (err: any) {
      setMsg({ kind: "err", text: err.message })
    } finally { setCreating(false) }
  }

  const saveReplay = async (id: string, replayUrl: string) => {
    const res = await fetch(`/api/webinars/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ replayUrl }),
    })
    if (res.ok) {
      // The count is the part worth saying out loud: these are the people whose
      // follow-up went out while the recording was still processing, so the
      // link they got led to an empty page. They only get the recording because
      // this send exists.
      const { replayQueued } = await res.json().catch(() => ({ replayQueued: 0 }))
      setMsg({
        kind: "ok",
        text: replayQueued > 0
          ? `Grabación guardada. Se la enviamos a ${replayQueued} ${replayQueued === 1 ? "persona que la estaba esperando" : "personas que la estaban esperando"} en los próximos 15 minutos.`
          : "Grabación guardada — la página de replay ya la muestra.",
      })
      load()
    }
    else setMsg({ kind: "err", text: "No se pudo guardar la grabación." })
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Webinars</h1>
          <p className="text-sm text-gray-500">
            Cada webinar tiene su página de registro y su grabación. Los recordatorios y el
            seguimiento salen solos.
          </p>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> Nuevo webinar
        </button>
      </div>

      {!zoomOk && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          Zoom no está configurado. Los webinars toman registros igual, pero sin enlace para entrar.
        </p>
      )}

      {msg && (
        <p className={`rounded-xl border px-4 py-3 text-sm ${
          msg.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-red-200 bg-red-50 text-red-700"}`}>
          {msg.text}
        </p>
      )}

      {showForm && (
        <form onSubmit={create} className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Título *</label>
            <input
              required value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Cómo invertir en Miami desde Colombia — Millenia Park"
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">
              Descripción * <span className="font-normal text-gray-400">— esto es lo que lee Google y lo que ve quien se registra</span>
            </label>
            <textarea
              required rows={3} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Los números reales de Millenia Park: precio por unidad, plan de pagos, renta estimada y el retorno después de gastos."
              className="w-full resize-none rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Fecha y hora (Miami) *</label>
              <input
                required type="datetime-local" value={form.startsAt}
                onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))}
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Duración (min)</label>
              <input
                type="number" min={10} max={480} value={form.durationMins}
                onChange={e => setForm(f => ({ ...f, durationMins: Number(e.target.value) }))}
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">
                Serie <span className="font-normal text-gray-400">— agrupa los semanales</span>
              </label>
              <input
                value={form.series}
                onChange={e => setForm(f => ({ ...f, series: e.target.value }))}
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">
              Proyecto <span className="font-normal text-gray-400">— enlaza los números y pone la foto de portada. Opcional.</span>
            </label>
            <select
              value={form.projectSlug}
              onChange={e => setForm(f => ({ ...f, projectSlug: e.target.value }))}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Sin proyecto</option>
              {INVESTMENT_PROJECTS.map(p => (
                <option key={p.slug} value={p.slug}>{p.name}</option>
              ))}
            </select>
          </div>

          <button
            type="submit" disabled={creating}
            className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {creating ? "Creando…" : "Crear webinar"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-12 text-center">
          <Video className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 font-semibold text-gray-700">Todavía no hay webinars</p>
          <p className="mt-1 text-sm text-gray-500">El primero puede ser de prueba — entra desde el celular dos minutos para ver si la asistencia se registra.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(w => <WebinarRow key={w.id} w={w} onSaveReplay={saveReplay} />)}
        </div>
      )}
    </div>
  )
}

function WebinarRow({ w, onSaveReplay }: { w: Webinar; onSaveReplay: (id: string, url: string) => void }) {
  const [replay, setReplay] = useState(w.replayUrl || "")
  const past = new Date(w.startsAt).getTime() < Date.now()
  const pageUrl = `${SITE}/webinar/${w.slug}`

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-gray-900">{w.title}</p>
          <p className="text-sm capitalize text-gray-500">{fmt(w.startsAt, w.timezone)} · {w.durationMins} min</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
          w.status === "CANCELLED" ? "bg-red-50 text-red-700"
            : w.status === "LIVE" ? "bg-emerald-50 text-emerald-700"
            : past ? "bg-gray-100 text-gray-600" : "bg-blue-50 text-blue-700"}`}>
          {w.status === "CANCELLED" ? "Cancelado" : w.status === "LIVE" ? "En vivo" : past ? "Terminado" : "Programado"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
        <span className="flex items-center gap-1.5 text-gray-700">
          <Users className="h-4 w-4 text-gray-400" />
          <strong>{w.registrations}</strong> registrados
          {past && <span className="text-gray-500">· {w.attendedCount} asistieron</span>}
          {/* Only once there is a recording — before that a zero here reads as
              a failure rather than as "nobody has been offered it yet". */}
          {past && w.replayUrl && (
            <span className="text-gray-500">· {w.replayWatchedCount} vieron la grabación</span>
          )}
        </span>
        <a href={pageUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 font-semibold text-indigo-600 hover:text-indigo-800">
          <Link2 className="h-4 w-4" /> Página de registro
        </a>
        {w.zoomMeetingId && (
          <a href={`/api/webinars/${w.id}/start`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700">
            <Radio className="h-4 w-4" /> Iniciar como anfitriona
          </a>
        )}
        {w.zoomJoinUrl && (
          <a href={w.zoomJoinUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-gray-600 hover:text-gray-800">
            <ExternalLink className="h-4 w-4" /> Enlace de los asistentes
          </a>
        )}
        {!w.zoomMeetingId && w.status !== "CANCELLED" && (
          <span className="text-xs text-amber-700">Zoom se crea 3 días antes</span>
        )}
      </div>

      {past && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <label className="mb-1 block text-xs font-semibold text-gray-600">
            Enlace de la grabación{" "}
            <span className="font-normal text-gray-400">
              — YouTube (no listado) o Vimeo se ven dentro de la página. Un enlace de zoom.us
              solo abre un botón hacia Zoom.
            </span>
          </label>
          <div className="flex gap-2">
            <input
              value={replay} onChange={e => setReplay(e.target.value)}
              placeholder="https://youtu.be/…"
              className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={() => onSaveReplay(w.id, replay)}
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
            >
              Guardar
            </button>
          </div>
          {w.replayUrl && (
            <a href={`${pageUrl}/replay`} target="_blank" rel="noopener noreferrer"
              className="mt-2 inline-block text-xs font-semibold text-indigo-600 hover:text-indigo-800">
              Ver la página de grabación →
            </a>
          )}
        </div>
      )}
    </div>
  )
}
