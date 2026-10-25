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
  invitedAt: string | null
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
    series: "inversion-miami", projectSlug: "", recorded: false,
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
        body: JSON.stringify({
          ...form,
          // A recording has no start time to convert — the server dates it now.
          startsAt: form.recorded ? undefined : toUtcIso(form.startsAt),
          timezone: ZONE,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo crear")
      setMsg({
        kind: "ok",
        text: form.recorded
          ? "Grabación creada. Pégale el enlace de YouTube en su fila, abajo."
          : `Creado. ${data.zoomNote || ""} Página: ${SITE}/webinar/${data.slug}`,
      })
      setShowForm(false)
      setForm({ title: "", description: "", startsAt: "", durationMins: 60, series: "inversion-miami", projectSlug: "", recorded: false })
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
          {/* First question, before anything else: is this a session with an
              audience, or a video? They need different fields, and asking up
              front is what stops somebody hunting for a recording box on a
              webinar that has not happened yet. */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, recorded: false }))}
              className={`rounded-xl border-2 px-3 py-3 text-left text-sm ${
                form.recorded
                  ? "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  : "border-indigo-500 bg-indigo-50 text-indigo-900"}`}
            >
              <span className="block font-bold">Sesión en vivo</span>
              <span className="block text-xs">Con fecha. Zoom, recordatorios y registro.</span>
            </button>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, recorded: true }))}
              className={`rounded-xl border-2 px-3 py-3 text-left text-sm ${
                form.recorded
                  ? "border-indigo-500 bg-indigo-50 text-indigo-900"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"}`}
            >
              <span className="block font-bold">Grabación</span>
              <span className="block text-xs">Un video que ya grabaste. Sin fecha ni Zoom.</span>
            </button>
          </div>

          {form.recorded && (
            <p className="rounded-xl bg-sky-50 px-3 py-2.5 text-xs leading-relaxed text-sky-900">
              Al crearla vas a poder pegarle el enlace de YouTube de una vez. A partir de
              ahí, a todo el que se registre a una sesión en vivo <strong>de esta misma serie</strong> con
              más de 20 horas de anticipación, el correo de confirmación le va a ofrecer ver
              esta grabación sin esperar.
            </p>
          )}

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

          <div className={`grid grid-cols-1 gap-3 ${form.recorded ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
            {!form.recorded && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Fecha y hora (Miami) *</label>
                <input
                  required type="datetime-local" value={form.startsAt}
                  onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
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
          {list.map(w => <WebinarRow key={w.id} w={w} onSaveReplay={saveReplay} onReload={load} />)}
        </div>
      )}
    </div>
  )
}

/**
 * "Invite my list" — the cheapest seats there are, and the ones most often
 * left on the table because doing it by hand means building a campaign and
 * pasting the right link.
 *
 * Opens to a count before it sends anything: a blast to the whole book cannot
 * be taken back, so the number has to be on screen first. SMS is off by
 * default and counted separately, because texting is its own permission and
 * its own cost.
 */
function InviteList({
  webinarId, invitedAt, onDone,
}: {
  webinarId: string
  invitedAt: string | null
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [counts, setCounts] = useState<{ emailCount: number; smsCount: number; alreadyRegistered: number } | null>(null)
  const [withSms, setWithSms] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const preview = async () => {
    setOpen(true)
    setCounts(null)
    const res = await fetch(`/api/webinars/${webinarId}/invite`)
    if (res.ok) setCounts(await res.json())
  }

  const send = async () => {
    if (!counts) return
    setSending(true)
    try {
      const res = await fetch(`/api/webinars/${webinarId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // force: the preview already told her it had been sent before, so
        // reaching this button again is the deliberate re-send.
        body: JSON.stringify({ email: true, sms: withSms, force: !!invitedAt }),
      })
      const data = await res.json()
      if (!res.ok) { setResult(data.error || "No se pudo enviar."); return }
      setResult(
        `Invitación enviada: ${data.emailSent} por correo` +
        (withSms ? ` y ${data.smsSent} por SMS` : "") + ".",
      )
      onDone()
    } finally { setSending(false) }
  }

  if (!open) {
    return (
      <div className="mt-3 border-t border-gray-100 pt-3">
        <button
          onClick={preview}
          className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
        >
          <Users className="h-4 w-4" />
          {invitedAt ? "Volver a invitar a mi lista" : "Invitar a mi lista"}
        </button>
        {invitedAt && (
          <p className="mt-1 text-xs text-gray-500">
            Ya invitaste a tu lista el {new Date(invitedAt).toLocaleDateString("es-US", { day: "numeric", month: "long" })}.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
      {result ? (
        <p className="text-sm font-semibold text-indigo-900">{result}</p>
      ) : !counts ? (
        <p className="text-sm text-gray-600">Contando a quién le llegaría…</p>
      ) : (
        <>
          <p className="text-sm text-gray-800">
            Le llega por correo a <strong>{counts.emailCount}</strong>{" "}
            {counts.emailCount === 1 ? "persona" : "personas"} de tu base.
            {counts.alreadyRegistered > 0 && (
              <span className="text-gray-600">
                {" "}({counts.alreadyRegistered} ya {counts.alreadyRegistered === 1 ? "está registrada" : "están registradas"} y{" "}
                {counts.alreadyRegistered === 1 ? "queda" : "quedan"} fuera.)
              </span>
            )}
          </p>

          <label className="mt-3 flex items-start gap-2 text-sm text-gray-800">
            <input
              type="checkbox"
              checked={withSms}
              onChange={e => setWithSms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300"
            />
            <span>
              Mandar también por SMS a <strong>{counts.smsCount}</strong>{" "}
              {counts.smsCount === 1 ? "persona" : "personas"}
              <span className="block text-xs text-gray-500">
                Solo a quien dio permiso de texto. El SMS cuesta; el correo no.
              </span>
            </span>
          </label>

          {invitedAt && (
            <p className="mt-3 rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-900">
              Ya invitaste a tu lista a este webinar. Si sigues, les llega otra vez.
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={send}
              disabled={sending || counts.emailCount === 0}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {sending ? "Enviando…" : "Enviar la invitación"}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function WebinarRow({
  w, onSaveReplay, onReload,
}: {
  w: Webinar
  onSaveReplay: (id: string, url: string) => void
  onReload: () => void
}) {
  const [replay, setReplay] = useState(w.replayUrl || "")
  const past = new Date(w.startsAt).getTime() < Date.now()
  const pageUrl = `${SITE}/webinar/${w.slug}`
  // A standalone recording: ended, and no Zoom meeting was ever booked for it.
  // Worth telling apart from a live session that finished, because the two want
  // different things from her — one is an asset, the other needs its recording
  // uploaded and its attendance read.
  const isRecording = w.status === "ENDED" && !w.zoomMeetingId

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-gray-900">{w.title}</p>
          {/* A recording has no meeting time worth showing — the date it was
              filed is not something she scheduled. Its series is, because that
              is what decides which live sessions get to offer it. */}
          <p className="text-sm capitalize text-gray-500">
            {isRecording
              ? `Grabación · ${w.durationMins} min${w.series ? ` · serie: ${w.series}` : ""}`
              : `${fmt(w.startsAt, w.timezone)} · ${w.durationMins} min`}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
          w.status === "CANCELLED" ? "bg-red-50 text-red-700"
            : w.status === "LIVE" ? "bg-emerald-50 text-emerald-700"
            : past ? "bg-gray-100 text-gray-600" : "bg-blue-50 text-blue-700"}`}>
          {w.status === "CANCELLED" ? "Cancelado"
            : w.status === "LIVE" ? "En vivo"
            : isRecording ? "Grabación"
            : past ? "Terminado" : "Programado"}
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
        {!w.zoomMeetingId && w.status !== "CANCELLED" && !isRecording && !past && (
          <span className="text-xs text-amber-700">Zoom se crea 3 días antes</span>
        )}
      </div>

      {/* The free seat-filler. Only before the session — after it, the thing to
          send is the recording, which is the field further down. */}
      {!past && w.status !== "CANCELLED" && (
        <InviteList webinarId={w.id} invitedAt={w.invitedAt} onDone={onReload} />
      )}

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
