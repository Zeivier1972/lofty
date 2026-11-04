"use client"

/**
 * Catherine's calendar for project landing pages, built for international
 * buyers (Colombia first).
 *
 * Same back end as /book: GET /api/appointments/slots for real availability,
 * POST /api/appointments/book for the appointment, task, confirmations and
 * the Facebook "Schedule" event. Differences that matter for this audience:
 *  - every time is shown in Miami AND the visitor's own time (Bogotá by
 *    default), so nobody shows up an hour off when Miami is on summer time;
 *  - Zoom is the default — a presentation, not a cold phone call;
 *  - the phone is taken as country code + number, so it is saved in full
 *    international format and the WhatsApp confirmation can reach it;
 *  - when the person already gave their details (the qualification form
 *    above), they arrive prefilled and only day + hour remain.
 */

import { useState, useEffect, useRef } from "react"
import { ChevronLeft, ChevronRight, CheckCircle2, Loader2, Video, Phone } from "lucide-react"
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isSameDay, isToday, isBefore, startOfDay,
} from "date-fns"
import { es } from "date-fns/locale"

const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
const MIAMI_TZ = "America/New_York"

const COUNTRIES: { label: string; code: string; tz: string; city: string }[] = [
  { label: "Colombia", code: "+57", tz: "America/Bogota", city: "Colombia" },
  { label: "Estados Unidos", code: "+1", tz: MIAMI_TZ, city: "Miami" },
  { label: "México", code: "+52", tz: "America/Mexico_City", city: "Ciudad de México" },
  { label: "Venezuela", code: "+58", tz: "America/Caracas", city: "Venezuela" },
  { label: "Ecuador", code: "+593", tz: "America/Guayaquil", city: "Ecuador" },
  { label: "Perú", code: "+51", tz: "America/Lima", city: "Perú" },
  { label: "Panamá", code: "+507", tz: "America/Panama", city: "Panamá" },
  { label: "España", code: "+34", tz: "Europe/Madrid", city: "España" },
  { label: "Otro país", code: "", tz: MIAMI_TZ, city: "Miami" },
]

export type CalendarPrefill = {
  firstName: string
  lastName?: string
  email?: string
  /** Full international number, e.g. +573001234567. */
  phone?: string
  country?: string
  /** One line for Catherine (form answers). */
  summary?: string
}

export type CalendarTheme = { accent: string; accentText: string; ink: string; muted: string; surface: string; line: string }

/** The instant in UTC for a Miami wall-clock date + "HH:mm". */
function miamiInstant(dateStr: string, hhmm: string): Date {
  const [y, mo, d] = dateStr.split("-").map(Number)
  const [h, mi] = hhmm.split(":").map(Number)
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi))
  // Offset of Miami at that moment, from how it renders the guess.
  const shown = new Date(guess.toLocaleString("en-US", { timeZone: MIAMI_TZ }))
  const utcShown = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }))
  return new Date(guess.getTime() + (utcShown.getTime() - shown.getTime()))
}

const clock = (d: Date, tz: string) =>
  d.toLocaleTimeString("es-CO", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true })
    .replace(/\s?a\.\s?m\./i, " a. m.").replace(/\s?p\.\s?m\./i, " p. m.")

export default function BookingCalendar({
  source, topic, pageLabel, theme, prefill, defaultCountry = "Colombia", heading, doneExtra,
}: {
  /** CAMPAIGN_TAGS key in /api/appointments/book, e.g. "PARKSIDE". */
  source: string
  topic: string
  /** e.g. "/parkside" — saved with the utm_* attribution. */
  pageLabel: string
  theme: CalendarTheme
  prefill?: CalendarPrefill
  defaultCountry?: string
  heading?: string
  /** Shown under the confirmation, e.g. the guide promised for booking. */
  doneExtra?: React.ReactNode
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [slots, setSlots] = useState<string[]>([])
  const [slotMinutes, setSlotMinutes] = useState(30)
  const [slotMessage, setSlotMessage] = useState<string | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [meetingType, setMeetingType] = useState<"ZOOM" | "PHONE">("ZOOM")
  const [error, setError] = useState<string | null>(null)
  const [f, setF] = useState({
    firstName: prefill?.firstName || "",
    lastName: prefill?.lastName || "",
    email: prefill?.email || "",
    country: prefill?.country || defaultCountry,
    phone: "",
  })
  const timesRef = useRef<HTMLDivElement>(null)

  const country = COUNTRIES.find(c => c.label === f.country) || COUNTRIES[0]
  const showLocal = country.tz !== MIAMI_TZ
  const hasPrefill = !!prefill?.firstName

  const monthStart = startOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: endOfMonth(currentMonth) })
  const startPadding = getDay(monthStart)
  const today = startOfDay(new Date())
  const dateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : ""

  useEffect(() => {
    if (!selectedDate) return
    setLoadingSlots(true)
    setSlots([])
    setSelectedTime(null)
    setSlotMessage(null)
    fetch(`/api/appointments/slots?date=${format(selectedDate, "yyyy-MM-dd")}`)
      .then(r => r.json())
      .then(data => {
        setSlots(data.slots || [])
        setSlotMinutes(data.slotMinutes || 30)
        if (!(data.slots || []).length) setSlotMessage(data.message || "No hay horarios disponibles ese día. Pruebe otro.")
        setTimeout(() => timesRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50)
      })
      .catch(() => setSlotMessage("No pudimos cargar los horarios. Intente otro día."))
      .finally(() => setLoadingSlots(false))
  }, [selectedDate])

  const label = (t: string) => {
    const at = miamiInstant(dateStr, t)
    return { miami: clock(at, MIAMI_TZ), local: clock(at, country.tz) }
  }

  const attribution = () => {
    if (typeof window === "undefined") return `pagina=${pageLabel}`
    const q = new URLSearchParams(window.location.search)
    const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"]
    const parts = keys.map(k => (q.get(k) ? `${k}=${q.get(k)}` : "")).filter(Boolean)
    return [`pagina=${pageLabel}`, ...parts].join(" · ")
  }

  const submit = async () => {
    setError(null)
    if (!selectedDate || !selectedTime) return setError("Elija el día y la hora de su presentación.")
    let phone = prefill?.phone || ""
    if (!hasPrefill) {
      if (!f.firstName.trim()) return setError("Escriba su nombre.")
      const digits = f.phone.replace(/[^\d]/g, "")
      phone = !digits ? "" : f.phone.trim().startsWith("+") ? `+${digits}` : `${country.code}${digits}`
      if (!f.email.trim() && !phone) return setError("Déjenos su WhatsApp o su correo para enviarle el enlace de Zoom.")
    }
    setSubmitting(true)
    try {
      const { miami, local } = label(selectedTime)
      const res = await fetch("/api/appointments/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateStr,
          time: selectedTime,
          slotMinutes,
          firstName: f.firstName.trim(),
          // The booking endpoint requires a last name.
          lastName: f.lastName.trim() || "-",
          email: f.email.trim(),
          phone,
          topic,
          message: [
            prefill?.summary,
            `País: ${f.country}`,
            showLocal ? `Hora elegida: ${miami} Miami = ${local} ${country.city}` : null,
          ].filter(Boolean).join(" | "),
          type: "BUYER_CONSULTATION",
          meetingType,
          source,
          sourceDetail: attribution(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "No se pudo agendar")
      try { (window as any).fbq?.("track", "Schedule", { content_name: topic }) } catch {}
      setDone(true)
    } catch (err: any) {
      setError(err.message || "Error al agendar. Intente de nuevo.")
    } finally {
      setSubmitting(false)
    }
  }

  const input = "mt-1 w-full border px-4 py-3 outline-none"
  const inputStyle = { borderColor: theme.line, background: "#fff" }

  if (done && selectedDate && selectedTime) {
    const { miami, local } = label(selectedTime)
    return (
      <div className="p-8 text-center" style={{ background: theme.surface, color: theme.ink }}>
        <CheckCircle2 className="mx-auto h-14 w-14" style={{ color: theme.accent }} aria-hidden="true" />
        <h3 className="mt-4 text-2xl font-semibold">Listo, {f.firstName.split(" ")[0]}. Su presentación quedó agendada</h3>
        <p className="mt-3" style={{ color: theme.muted }}>
          <strong className="capitalize">{format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}</strong> a las{" "}
          <strong>{miami}</strong> hora de Miami{showLocal ? <> (<strong>{local}</strong> en {country.city})</> : null}.
        </p>
        <p className="mt-3" style={{ color: theme.muted }}>
          {meetingType === "ZOOM"
            ? "Le enviamos el enlace de Zoom y le recordaremos la cita el día anterior y una hora antes."
            : "Catherine le llamará a la hora acordada. Le recordaremos la cita el día anterior y una hora antes."}
        </p>
        {doneExtra}
      </div>
    )
  }

  return (
    <div className="p-5 sm:p-7" style={{ background: theme.surface, color: theme.ink }}>
      {heading && <p className="mb-4 text-lg font-semibold">{heading}</p>}

      {!hasPrefill && (
        <label className="mb-5 block">
          <span className="text-sm font-medium">¿Desde qué país nos acompaña?</span>
          <select
            value={f.country}
            onChange={e => setF({ ...f, country: e.target.value })}
            className={input}
            style={inputStyle}
          >
            {COUNTRIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
          </select>
        </label>
      )}

      <p className="text-[11px] font-medium uppercase tracking-[0.2em]" style={{ color: theme.muted }}>Paso 1 · Elija el día</p>
      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          disabled={isSameDay(startOfMonth(currentMonth), startOfMonth(today))}
          className="p-2 disabled:opacity-30"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="font-semibold capitalize">{format(currentMonth, "MMMM yyyy", { locale: es })}</p>
        <button type="button" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2" aria-label="Mes siguiente">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-medium" style={{ color: theme.muted }}>
        {DAYS_ES.map(d => <span key={d} className="py-1">{d}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: startPadding }).map((_, i) => <span key={`pad-${i}`} />)}
        {days.map(day => {
          const past = isBefore(day, today)
          const active = !!selectedDate && isSameDay(day, selectedDate)
          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={past}
              onClick={() => setSelectedDate(day)}
              aria-pressed={active}
              aria-label={format(day, "EEEE d 'de' MMMM", { locale: es })}
              className="aspect-square text-sm font-medium transition disabled:cursor-not-allowed"
              style={active
                ? { background: theme.accent, color: theme.accentText }
                : { color: past ? "rgba(0,0,0,.25)" : theme.ink, outline: !past && isToday(day) ? `1px solid ${theme.accent}` : undefined }}
            >
              {format(day, "d")}
            </button>
          )
        })}
      </div>

      {selectedDate && (
        <div ref={timesRef} className="mt-6 border-t pt-5" style={{ borderColor: theme.line }}>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em]" style={{ color: theme.muted }}>
            Paso 2 · Elija la hora {showLocal ? `(hora de ${country.city})` : "(hora de Miami)"}
          </p>
          {loadingSlots ? (
            <p className="mt-3 flex items-center gap-2 text-sm" style={{ color: theme.muted }}>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Buscando horarios…
            </p>
          ) : slots.length ? (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {slots.map(t => {
                const { miami, local } = label(t)
                const on = selectedTime === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedTime(t)}
                    aria-pressed={on}
                    className="border px-2 py-2.5 text-sm font-medium transition"
                    style={on
                      ? { background: theme.accent, borderColor: theme.accent, color: theme.accentText }
                      : { borderColor: theme.line, background: "#fff", color: theme.ink }}
                  >
                    {showLocal ? local : miami}
                    {showLocal && <span className="block text-[11px] font-normal opacity-70">{miami} Miami</span>}
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="mt-3 text-sm" style={{ color: theme.muted }}>{slotMessage}</p>
          )}
        </div>
      )}

      <fieldset className="mt-6 border-t pt-5" style={{ borderColor: theme.line }}>
        <legend className="text-[11px] font-medium uppercase tracking-[0.2em]" style={{ color: theme.muted }}>Paso 3 · ¿Cómo prefiere la reunión?</legend>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {([["ZOOM", "Zoom (recomendado)", Video], ["PHONE", "Llamada / WhatsApp", Phone]] as const).map(([v, text, Icon]) => (
            <button
              key={v}
              type="button"
              onClick={() => setMeetingType(v)}
              aria-pressed={meetingType === v}
              className="flex items-center justify-center gap-2 border px-3 py-3 text-sm font-medium transition"
              style={meetingType === v
                ? { borderColor: theme.accent, background: "#fff", color: theme.ink, boxShadow: `inset 0 0 0 1px ${theme.accent}` }
                : { borderColor: theme.line, background: "#fff", color: theme.muted }}
            >
              <Icon className="h-4 w-4" aria-hidden="true" /> {text}
            </button>
          ))}
        </div>
      </fieldset>

      {!hasPrefill && (
        <div className="mt-6 space-y-4 border-t pt-5" style={{ borderColor: theme.line }}>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em]" style={{ color: theme.muted }}>Paso 4 · Sus datos</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">Nombre *
              <input autoComplete="given-name" value={f.firstName} onChange={e => setF({ ...f, firstName: e.target.value })} className={input} style={inputStyle} />
            </label>
            <label className="block text-sm font-medium">Apellido
              <input autoComplete="family-name" value={f.lastName} onChange={e => setF({ ...f, lastName: e.target.value })} className={input} style={inputStyle} />
            </label>
          </div>
          <label className="block text-sm font-medium">WhatsApp {country.code ? `(${country.code})` : ""}
            <input
              type="tel" inputMode="tel" autoComplete="tel" value={f.phone}
              placeholder={country.code === "+57" ? "300 123 4567" : ""}
              onChange={e => setF({ ...f, phone: e.target.value })}
              className={input} style={inputStyle}
            />
          </label>
          <label className="block text-sm font-medium">Correo electrónico
            <input type="email" autoComplete="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} className={input} style={inputStyle} />
          </label>
        </div>
      )}

      {error && <p className="mt-4 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="mt-5 flex w-full items-center justify-center gap-2 px-6 py-4 text-sm font-semibold uppercase tracking-[0.14em] transition hover:brightness-110 disabled:opacity-60"
        style={{ background: theme.accent, color: theme.accentText }}
      >
        {submitting
          ? <><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Agendando…</>
          : selectedDate && selectedTime
            ? `Confirmar · ${showLocal ? label(selectedTime).local : label(selectedTime).miami}`
            : "Confirmar mi presentación"}
      </button>
      <p className="mt-2 text-center text-xs" style={{ color: theme.muted }}>
        30 minutos · Sin costo ni compromiso · En español
      </p>
    </div>
  )
}
