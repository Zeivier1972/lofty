"use client"

/**
 * The calendar under the quiz result. Same back end as /book and /domus:
 * GET /api/appointments/slots reads Catherine's real availability and POST
 * /api/appointments/book creates the appointment, the task, the
 * confirmations and the Facebook "Schedule" event.
 *
 * The person already gave their name and contact details in the quiz, so
 * those arrive prefilled and only the day, the hour and phone/Zoom remain.
 */

import { useState, useEffect, useRef } from "react"
import { ChevronLeft, ChevronRight, Clock, CheckCircle2, Loader2, Video, Phone } from "lucide-react"
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isSameDay, isToday, isBefore, startOfDay,
} from "date-fns"
import { es } from "date-fns/locale"

const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

export type BookingPrefill = {
  firstName: string
  lastName: string
  email: string
  phone: string
  /** One line for Catherine: the estimate and the answers that matter. */
  summary: string
}

export default function BookingForm({ prefill, sourceDetail }: { prefill: BookingPrefill; sourceDetail: string }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [slots, setSlots] = useState<string[]>([])
  const [slotMinutes, setSlotMinutes] = useState(30)
  const [slotMessage, setSlotMessage] = useState<string | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [meetingType, setMeetingType] = useState<"PHONE" | "ZOOM">("PHONE")
  const [error, setError] = useState<string | null>(null)
  const timesRef = useRef<HTMLDivElement>(null)

  const monthStart = startOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: endOfMonth(currentMonth) })
  const startPadding = getDay(monthStart)
  const today = startOfDay(new Date())

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
        if (!(data.slots || []).length) setSlotMessage(data.message || "No hay horarios disponibles ese día. Prueba otro.")
        setTimeout(() => timesRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50)
      })
      .catch(() => setSlotMessage("No pudimos cargar los horarios. Intenta otro día."))
      .finally(() => setLoadingSlots(false))
  }, [selectedDate])

  const time12 = (t: string) => {
    const [h, m] = t.split(":").map(Number)
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`
  }

  const submit = async () => {
    if (!selectedDate || !selectedTime) {
      setError("Elige el día y la hora de tu llamada.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/appointments/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: format(selectedDate, "yyyy-MM-dd"),
          time: selectedTime,
          slotMinutes,
          firstName: prefill.firstName,
          // The booking endpoint requires a last name; the quiz does not.
          lastName: prefill.lastName || "-",
          email: prefill.email,
          phone: prefill.phone,
          topic: "Primera casa — plan de compra",
          message: prefill.summary,
          type: "BUYER_CONSULTATION",
          meetingType,
          source: "PRIMERA_CASA",
          sourceDetail,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo agendar")
      setDone(true)
    } catch (err: any) {
      setError(err.message || "Error al agendar. Intenta de nuevo.")
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" aria-hidden="true" />
        <h3 className="mt-4 text-2xl font-bold text-slate-900">¡Listo, {prefill.firstName}! Tu llamada está agendada</h3>
        <p className="mt-3 text-slate-600">
          {selectedDate && (
            <>
              <strong className="capitalize">{format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}</strong>
              {selectedTime ? <> a las <strong>{time12(selectedTime)}</strong> (hora de Miami)</> : null}.{" "}
            </>
          )}
          Te enviamos la confirmación{prefill.phone ? " por mensaje" : ""}{prefill.email ? " y por correo" : ""}.
          Catherine te {meetingType === "ZOOM" ? "espera en Zoom" : "llamará"} con tu plan para comprar tu primera casa.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Paso 1 · Elige el día</p>
      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          disabled={isSameDay(startOfMonth(currentMonth), startOfMonth(today))}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="font-semibold capitalize text-slate-900">{format(currentMonth, "MMMM yyyy", { locale: es })}</p>
        <button
          type="button"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-400">
        {DAYS_ES.map(d => <span key={d} className="py-1">{d}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: startPadding }).map((_, i) => <span key={`pad-${i}`} />)}
        {days.map(day => {
          const past = isBefore(day, today)
          const active = selectedDate && isSameDay(day, selectedDate)
          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={past}
              onClick={() => setSelectedDate(day)}
              aria-pressed={!!active}
              aria-label={format(day, "EEEE d 'de' MMMM", { locale: es })}
              className={[
                "aspect-square rounded-lg text-sm font-medium transition",
                past ? "cursor-not-allowed text-slate-300" : "text-slate-700 hover:bg-emerald-50",
                active ? "!bg-emerald-600 !text-white" : "",
                !active && isToday(day) ? "ring-1 ring-emerald-500" : "",
              ].join(" ")}
            >
              {format(day, "d")}
            </button>
          )
        })}
      </div>

      {selectedDate && (
        <div ref={timesRef} className="mt-6 border-t border-slate-100 pt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Paso 2 · Elige la hora (hora de Miami)</p>
          {loadingSlots ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Buscando horarios…
            </p>
          ) : slots.length ? (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedTime(t)}
                  aria-pressed={selectedTime === t}
                  className={[
                    "flex items-center justify-center gap-1 rounded-lg border px-2 py-2.5 text-sm font-medium transition",
                    selectedTime === t
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-200 text-slate-700 hover:border-emerald-500",
                  ].join(" ")}
                >
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {time12(t)}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">{slotMessage}</p>
          )}
        </div>
      )}

      <fieldset className="mt-6 border-t border-slate-100 pt-5">
        <legend className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Paso 3 · ¿Cómo prefieres hablar?</legend>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {([["PHONE", "Llamada", Phone], ["ZOOM", "Zoom", Video]] as const).map(([v, label, Icon]) => (
            <button
              key={v}
              type="button"
              onClick={() => setMeetingType(v)}
              aria-pressed={meetingType === v}
              className={[
                "flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition",
                meetingType === v ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
      </fieldset>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-4 text-base font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
      >
        {submitting
          ? <><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Agendando…</>
          : selectedDate && selectedTime
            ? `Confirmar mi llamada — ${time12(selectedTime)}`
            : "Confirmar mi llamada gratis"}
      </button>
      <p className="mt-2 text-center text-xs text-slate-500">15–30 minutos · Sin costo ni compromiso · En español o inglés</p>
    </div>
  )
}
