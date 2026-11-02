"use client"

import { useEffect, useState } from "react"
import { Loader2, Video, Users, Link2, Plus, ExternalLink, AlertTriangle, Radio, Pencil, Ban, Trash2 } from "lucide-react"
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
  invitedTags: string
  repeatWeekly: boolean
  autoInviteTags: string
}

const tagsOf = (raw: string | null | undefined): string[] => {
  try { const v = JSON.parse(raw || "[]"); return Array.isArray(v) ? v.map(String) : [] } catch { return [] }
}

/**
 * Pick CRM tags ("Domus", "Investor_colombia"…) from a dropdown with
 * checkboxes; several can be chosen. None selected means everyone.
 * The list (with contact counts) is fetched once per page and shared.
 */
type TagOpt = { name: string; count: number }
let tagCache: Promise<TagOpt[]> | null = null
function loadTags(): Promise<TagOpt[]> {
  if (!tagCache) {
    tagCache = fetch("/api/tags?counts=1").then(r => r.ok ? r.json() : []).then((t: any[]) =>
      Array.isArray(t) ? t.map(x => ({ name: String(x.name), count: Number(x.count) || 0 })).filter(x => x.name) : []).catch(() => [])
  }
  return tagCache
}

/** Tags that mark the Colombian investor audience. */
const COLOMBIA_RX = /colombia|bogot|medell|\bcali\b|barranquilla|cartagena|domus/i

function TagPicker({ value, onChange, emptyLabel }: {
  value: string[]
  onChange: (v: string[]) => void
  emptyLabel: string
}) {
  const [all, setAll] = useState<TagOpt[]>([])
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  useEffect(() => { loadTags().then(setAll) }, [])
  const shown = all.filter(t => !q || t.name.toLowerCase().includes(q.toLowerCase()))
  const toggle = (t: string) => onChange(value.includes(t) ? value.filter(x => x !== t) : [...value, t])
  const colombia = all.filter(t => COLOMBIA_RX.test(t.name)).map(t => t.name)

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-left text-sm hover:border-indigo-400">
        <span className={value.length ? "text-gray-900" : "text-gray-500"}>
          {value.length ? `${value.length} ${value.length === 1 ? "etiqueta elegida" : "etiquetas elegidas"}` : emptyLabel}
        </span>
        <span className="text-gray-400">{open ? "▲" : "▼"}</span>
      </button>

      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {value.map(t => (
            <button key={t} type="button" onClick={() => toggle(t)}
              className="rounded-full bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700">
              {t} ✕
            </button>
          ))}
          <button type="button" onClick={() => onChange([])} className="text-xs font-semibold text-gray-500 hover:text-gray-800">
            Quitar todas
          </button>
        </div>
      )}

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar etiqueta…"
            className="mb-2 w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          {colombia.length > 0 && !q && (
            <button type="button"
              onClick={() => onChange(Array.from(new Set([...value, ...colombia])))}
              className="mb-2 w-full rounded-lg bg-amber-50 px-2.5 py-2 text-left text-xs font-semibold text-amber-900 hover:bg-amber-100">
              🇨🇴 Agregar todas las de inversionistas colombianos ({colombia.join(", ")})
            </button>
          )}
          <div className="max-h-64 overflow-y-auto">
            {shown.map(t => (
              <label key={t.name} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50">
                <input type="checkbox" checked={value.includes(t.name)} onChange={() => toggle(t.name)}
                  className="h-4 w-4 rounded border-gray-300" />
                <span className="flex-1 text-gray-800">{t.name}</span>
                <span className="text-xs text-gray-400">{t.count}</span>
              </label>
            ))}
            {all.length === 0 && <p className="px-2 py-1.5 text-xs text-gray-400">No hay etiquetas en el CRM todavía.</p>}
            {all.length > 0 && shown.length === 0 && <p className="px-2 py-1.5 text-xs text-gray-400">Ninguna coincide.</p>}
          </div>
          <div className="mt-2 flex justify-end border-t border-gray-100 pt-2">
            <button type="button" onClick={() => setOpen(false)}
              className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800">
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  )
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

/** The reverse of toUtcIso: a UTC instant as a Miami `datetime-local` value. */
function toMiamiLocal(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find(p => p.type === t)?.value || "00"
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`
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
    repeatWeekly: false, autoInviteTags: [] as string[],
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
          : form.repeatWeekly && data.series
            ? `Creado y se repite cada semana. ${data.zoomNote || ""} Enlace fijo para tu bio: ${SITE}/webinar/serie/${data.series}`
            : `Creado. ${data.zoomNote || ""} Página: ${SITE}/webinar/${data.slug}`,
      })
      setShowForm(false)
      setForm({ title: "", description: "", startsAt: "", durationMins: 60, series: "inversion-miami", projectSlug: "", recorded: false, repeatWeekly: false, autoInviteTags: [] })
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

          {!form.recorded && (
            <div className="rounded-xl border border-gray-200 p-3">
              <label className="flex items-start gap-2 text-sm text-gray-800">
                <input type="checkbox" checked={form.repeatWeekly}
                  onChange={e => setForm(f => ({ ...f, repeatWeekly: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300" />
                <span>
                  <strong>Repetir cada semana</strong> el mismo día y a la misma hora
                  <span className="block text-xs text-gray-500">
                    Al terminar cada sesión se crea sola la de la semana siguiente, con su Zoom y sus recordatorios.
                    Tendrás un enlace fijo que siempre lleva a la próxima sesión.
                  </span>
                </span>
              </label>
              {form.repeatWeekly && (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <p className="mb-1.5 text-xs font-semibold text-gray-600">
                    Invitar automáticamente por correo, 2 días antes, a los contactos con estas etiquetas:
                  </p>
                  <TagPicker value={form.autoInviteTags}
                    onChange={v => setForm(f => ({ ...f, autoInviteTags: v }))}
                    emptyLabel="Ninguna — invitas tú con el botón cada semana." />
                </div>
              )}
            </div>
          )}

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
  const [tags, setTags] = useState<string[]>([])

  const count = async (t: string[]) => {
    setCounts(null)
    const res = await fetch(`/api/webinars/${webinarId}/invite?tags=${encodeURIComponent(JSON.stringify(t))}`)
    if (res.ok) setCounts(await res.json())
  }
  const preview = async () => { setOpen(true); count(tags) }
  const pickTags = (t: string[]) => { setTags(t); count(t) }

  const send = async () => {
    if (!counts) return
    setSending(true)
    try {
      const res = await fetch(`/api/webinars/${webinarId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // force: the preview already told her it had been sent before, so
        // reaching this button again is the deliberate re-send.
        body: JSON.stringify({ email: true, sms: withSms, force: !!invitedAt, tags }),
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
      ) : (
        <>
          <div className="mb-3">
            <p className="mb-1.5 text-xs font-semibold text-gray-700">¿A quién? Elige etiquetas o deja vacío para toda tu base.</p>
            <TagPicker value={tags} onChange={pickTags} emptyLabel="Toda tu base de contactos" />
          </div>
          {!counts ? (
            <p className="text-sm text-gray-600">Contando a quién le llegaría…</p>
          ) : (
          <>
          <p className="text-sm text-gray-800">
            Le llega por correo a <strong>{counts.emailCount}</strong>{" "}
            {counts.emailCount === 1 ? "persona" : "personas"}{" "}
            {tags.length ? <>con {tags.length === 1 ? "la etiqueta" : "las etiquetas"} <strong>{tags.join(", ")}</strong></> : "de tu base"}.
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
  // The date and length only move for a session that hasn't happened yet.
  const canMove = w.status === "SCHEDULED" && !past && !isRecording
  const canCancel = !past && w.status !== "CANCELLED" && w.status !== "ENDED" && !isRecording

  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [edit, setEdit] = useState({
    title: w.title, description: w.description || "", projectSlug: w.projectSlug || "",
    startsAt: toMiamiLocal(w.startsAt), durationMins: String(w.durationMins), notify: true,
    repeatWeekly: w.repeatWeekly, autoInviteTags: tagsOf(w.autoInviteTags),
  })
  const seriesUrl = w.series ? `${SITE}/webinar/serie/${w.series}` : null
  const [copied, setCopied] = useState(false)
  const dateChanged = canMove && edit.startsAt !== toMiamiLocal(w.startsAt)

  async function call(method: "PATCH" | "DELETE", body?: Record<string, unknown>) {
    setBusy(true); setMsg(null)
    try {
      const res = await fetch(`/api/webinars/${w.id}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg({ ok: false, text: data.error || "No se pudo guardar" }); return null }
      return data
    } catch {
      setMsg({ ok: false, text: "Error de conexión" }); return null
    } finally { setBusy(false) }
  }

  async function saveEdit() {
    const body: Record<string, unknown> = {
      title: edit.title, description: edit.description, projectSlug: edit.projectSlug || null,
    }
    if (canMove) {
      if (dateChanged) {
        const iso = toUtcIso(edit.startsAt)
        if (!iso) { setMsg({ ok: false, text: "Fecha inválida" }); return }
        body.startsAt = iso
        body.notify = edit.notify
      }
      if (Number(edit.durationMins) !== w.durationMins) body.durationMins = Number(edit.durationMins)
      body.repeatWeekly = edit.repeatWeekly
      body.autoInviteTags = edit.repeatWeekly ? edit.autoInviteTags : []
    }
    const data = await call("PATCH", body)
    if (!data) return
    setEditing(false)
    setMsg({ ok: true, text: data.notified ? `Guardado. Se avisó a ${data.notified} registrado(s) de la nueva fecha.` : "Cambios guardados." })
    onReload()
  }

  async function cancelWebinar() {
    if (!confirm(`¿Cancelar "${w.title}"? Se borra la reunión de Zoom y dejan de salir los recordatorios.` +
      (w.repeatWeekly ? "\n\nSolo se cancela esta semana: la serie sigue y se crea la sesión de la semana siguiente." : ""))) return
    const notify = w.registrations > 0 && confirm(`¿Enviar un correo a los ${w.registrations} registrados avisando que se canceló?`)
    const data = await call("PATCH", { status: "CANCELLED", notify })
    if (!data) return
    setMsg({ ok: true, text: data.notified ? `Cancelado. Se avisó a ${data.notified} registrado(s).` : "Webinar cancelado." })
    onReload()
  }

  async function deleteWebinar() {
    if (!confirm(`¿Eliminar "${w.title}" para siempre? Esto no se puede deshacer.` +
      (w.repeatWeekly ? "\n\nOjo: es la sesión que mantiene la serie semanal. Si la eliminas, la serie se detiene. Para saltarte solo esta semana usa Cancelar." : ""))) return
    const data = await call("DELETE")
    if (data) onReload()
  }

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

      {w.repeatWeekly && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-violet-50 px-2.5 py-1 font-semibold text-violet-700">🔁 Se repite cada semana</span>
          {tagsOf(w.autoInviteTags).length > 0 && (
            <span className="text-gray-600">Invitación automática 2 días antes a: <strong>{tagsOf(w.autoInviteTags).join(", ")}</strong></span>
          )}
          {seriesUrl && (
            <button type="button"
              onClick={() => { navigator.clipboard?.writeText(seriesUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }) }}
              className="font-semibold text-indigo-600 hover:text-indigo-800">
              {copied ? "✓ Enlace copiado" : "Copiar enlace fijo para la bio"}
            </button>
          )}
        </div>
      )}

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

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <button onClick={() => { setEditing(e => !e); setMsg(null) }} disabled={busy}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">
          <Pencil className="h-3.5 w-3.5" /> {editing ? "Cerrar" : "Editar"}
        </button>
        {canCancel && (
          <button onClick={cancelWebinar} disabled={busy}
            className="flex items-center gap-1 rounded-lg border border-amber-300 px-2.5 py-1.5 font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-60">
            <Ban className="h-3.5 w-3.5" /> Cancelar webinar
          </button>
        )}
        {w.registrations === 0 ? (
          <button onClick={deleteWebinar} disabled={busy}
            className="flex items-center gap-1 rounded-lg border border-red-300 px-2.5 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">
            <Trash2 className="h-3.5 w-3.5" /> Eliminar
          </button>
        ) : (
          <span className="text-gray-400">Con registrados no se elimina — cancélalo para conservar los contactos.</span>
        )}
        {busy && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
      </div>
      {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}

      {editing && (
        <div className="mt-3 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Título</label>
            <input value={edit.title} onChange={e => setEdit(f => ({ ...f, title: e.target.value }))}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Descripción</label>
            <textarea rows={3} value={edit.description} onChange={e => setEdit(f => ({ ...f, description: e.target.value }))}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          {canMove && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Fecha y hora (Miami)</label>
                <input type="datetime-local" value={edit.startsAt} onChange={e => setEdit(f => ({ ...f, startsAt: e.target.value }))}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Duración (min)</label>
                <input type="number" min={10} max={480} value={edit.durationMins} onChange={e => setEdit(f => ({ ...f, durationMins: e.target.value }))}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          )}
          {canMove && (
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input type="checkbox" checked={edit.repeatWeekly}
                  onChange={e => setEdit(f => ({ ...f, repeatWeekly: e.target.checked }))} />
                <strong>Repetir cada semana</strong>
                <span className="text-xs text-gray-500">(desmárcalo para que esta sea la última)</span>
              </label>
              {edit.repeatWeekly && (
                <div className="mt-2">
                  <p className="mb-1.5 text-xs font-semibold text-gray-600">Invitar automáticamente por correo, 2 días antes, a:</p>
                  <TagPicker value={edit.autoInviteTags}
                    onChange={v => setEdit(f => ({ ...f, autoInviteTags: v }))}
                    emptyLabel="Ninguna — invitas tú con el botón." />
                </div>
              )}
            </div>
          )}
          {dateChanged && w.registrations > 0 && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={edit.notify} onChange={e => setEdit(f => ({ ...f, notify: e.target.checked }))} />
              Avisar por correo a los {w.registrations} registrados de la nueva fecha
            </label>
          )}
          {dateChanged && w.zoomMeetingId && (
            <p className="text-xs text-amber-700">La reunión de Zoom actual se borra y se crea una nueva 3 días antes de la nueva fecha. Los recordatorios se vuelven a enviar.</p>
          )}
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Proyecto</label>
            <select value={edit.projectSlug} onChange={e => setEdit(f => ({ ...f, projectSlug: e.target.value }))}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Sin proyecto</option>
              {INVESTMENT_PROJECTS.map(p => <option key={p.slug} value={p.slug}>{p.name}</option>)}
            </select>
          </div>
          <button onClick={saveEdit} disabled={busy || !edit.title.trim()}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
            {busy ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      )}

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
