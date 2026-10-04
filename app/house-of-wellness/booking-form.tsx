"use client"

/**
 * House of Wellness — appointment booking.
 *
 * Talks to the CRM calendar that already runs the site: GET
 * /api/appointments/slots reads Catherine's real availability (and blocks out
 * anything already booked), POST /api/appointments/book creates the Contact,
 * the Appointment, the task and the notifications. No external scheduler.
 *
 * The lead is tagged source = HOUSE_OF_WELLNESS, and whatever Facebook put in
 * the URL (utm_*, fbclid) is saved on the contact as a note, so the leads this
 * campaign brought in can actually be counted.
 */

import { useState, useEffect } from "react"
import {
  ChevronLeft, ChevronRight, Clock, CheckCircle2, Loader2, Video, Phone,
} from "lucide-react"
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isSameDay, isToday, isBefore, startOfDay,
} from "date-fns"
import { es } from "date-fns/locale"

const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

const INTERESTS = [
  "Estudio (371 sqft)",
  "1 recámara",
  "1 recámara · 1 baño",
  "2 recámaras (620 sqft)",
  "Todavía no estoy seguro",
]

/** Everything Facebook (or any other campaign) appended to the link. */
function campaignDetail(): string {
  if (typeof window === "undefined") return ""
  const q = new URLSearchParams(window.location.search)
  const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "ad", "adset"]
  const parts = keys
    .map(k => (q.get(k) ? `${k}=${q.get(k)}` : ""))
    .filter(Boolean)
  if (!parts.length && document.referrer) parts.push(`referrer=${document.referrer}`)
  return ["pagina=/house-of-wellness", ...parts].join(" · ")
}

export default function BookingForm() {
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
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", interest: "", message: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

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
        if (!(data.slots || []).length) setSlotMessage(data.message || "No hay horarios disponibles ese día.")
      })
      .catch(() => setSlotMessage("No pudimos cargar los horarios. Intenta otro día."))
      .finally(() => setLoadingSlots(false))
  }, [selectedDate])

  const validate = () => {
    const e: Record<string, string> = {}
    if (!selectedDate) e.date = "Elige un día"
    if (!selectedTime) e.time = "Elige una hora"
    if (!form.firstName.trim()) e.firstName = "Requerido"
    if (!form.lastName.trim()) e.lastName = "Requerido"
    if (!form.email.trim() && !form.phone.trim()) e.email = "Déjanos tu email o tu teléfono"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate() || !selectedDate || !selectedTime) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/appointments/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: format(selectedDate, "yyyy-MM-dd"),
          time: selectedTime,
          slotMinutes,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          topic: `House of Wellness Brickell${form.interest ? ` — ${form.interest}` : ""}`,
          message: form.message,
          type: "BUYER_CONSULTATION",
          meetingType,
          source: "HOUSE_OF_WELLNESS",
          sourceDetail: campaignDetail(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo agendar")
      setDone(true)
    } catch (err: any) {
      setErrors({ submit: err.message || "Error al agendar. Intenta de nuevo." })
    } finally {
      setSubmitting(false)
    }
  }

  const time12 = (t: string) => {
    const [h, m] = t.split(":").map(Number)
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`
  }

  if (done) {
    return (
      <div className="rounded-none bg-[#FAF8F4] p-10 text-center ring-1 ring-black/5">
        <CheckCircle2 className="mx-auto h-16 w-16 text-[#C5A572]" aria-hidden="true" />
        <h3 className="mt-5 text-2xl font-bold text-[#0C0B0A]">¡Tu cita está agendada!</h3>
        <p className="mt-3 text-[#57514A]">
          {selectedDate && (
            <>
              <strong>{format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}</strong>
              {selectedTime ? <> a las <strong>{time12(selectedTime)}</strong></> : null}.{" "}
            </>
          )}
          Te enviamos la confirmación por correo. Catherine te contactará
          {meetingType === "ZOOM" ? " por Zoom" : " por teléfono"} a la hora acordada.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="rounded-none bg-[#FAF8F4] p-6 ring-1 ring-black/5 sm:p-8">
      {/* Step 1 — day */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          disabled={isSameDay(startOfMonth(currentMonth), startOfMonth(today))}
          className="rounded-none p-2 text-[#7A736A] hover:bg-[#F2EDE4] disabled:opacity-30"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="font-semibold capitalize text-[#0C0B0A]">
          {format(currentMonth, "MMMM yyyy", { locale: es })}
        </p>
        <button
          type="button"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="rounded-none p-2 text-[#7A736A] hover:bg-[#F2EDE4]"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-medium text-[#9A9289]">
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
              className={[
                "aspect-square rounded-none text-sm font-medium transition",
                past ? "cursor-not-allowed text-[#CFC8BE]" : "text-[#3D3831] hover:bg-[#F2EDE4]",
                active ? "!bg-[#C5A572] !text-[#0C0B0A]" : "",
                !active && isToday(day) ? "ring-1 ring-[#C5A572]" : "",
              ].join(" ")}
            >
              {format(day, "d")}
            </button>
          )
        })}
      </div>
      {errors.date && <p className="mt-2 text-sm text-red-600">{errors.date}</p>}

      {/* Step 2 — time */}
      {selectedDate && (
        <div className="mt-6 border-t border-[#EDE7DD] pt-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#0C0B0A]">
            <Clock className="h-4 w-4" aria-hidden="true" /> Horarios disponibles
          </p>
          {loadingSlots ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-[#7A736A]">
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
                    "rounded-none border px-2 py-2.5 text-sm font-medium transition",
                    selectedTime === t
                      ? "border-[#C5A572] bg-[#C5A572] text-white"
                      : "border-[#E2DBD0] text-[#3D3831] hover:border-[#C5A572] hover:text-[#8A6D32]",
                  ].join(" ")}
                >
                  {time12(t)}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[#7A736A]">{slotMessage}</p>
          )}
          {errors.time && <p className="mt-2 text-sm text-red-600">{errors.time}</p>}
        </div>
      )}

      {/* Step 3 — details */}
      <div className="mt-6 space-y-4 border-t border-[#EDE7DD] pt-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="hw-first" className="text-sm font-medium text-[#3D3831]">Nombre *</label>
            <input
              id="hw-first" required value={form.firstName}
              onChange={e => setForm({ ...form, firstName: e.target.value })}
              className="mt-1 w-full rounded-none border border-[#E2DBD0] px-4 py-3 outline-none focus:border-[#C5A572]"
            />
            {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>}
          </div>
          <div>
            <label htmlFor="hw-last" className="text-sm font-medium text-[#3D3831]">Apellido *</label>
            <input
              id="hw-last" required value={form.lastName}
              onChange={e => setForm({ ...form, lastName: e.target.value })}
              className="mt-1 w-full rounded-none border border-[#E2DBD0] px-4 py-3 outline-none focus:border-[#C5A572]"
            />
            {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="hw-email" className="text-sm font-medium text-[#3D3831]">Correo electrónico</label>
            <input
              id="hw-email" type="email" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full rounded-none border border-[#E2DBD0] px-4 py-3 outline-none focus:border-[#C5A572]"
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          </div>
          <div>
            <label htmlFor="hw-phone" className="text-sm font-medium text-[#3D3831]">WhatsApp / Teléfono</label>
            <input
              id="hw-phone" type="tel" value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              className="mt-1 w-full rounded-none border border-[#E2DBD0] px-4 py-3 outline-none focus:border-[#C5A572]"
            />
          </div>
        </div>
        <div>
          <label htmlFor="hw-interest" className="text-sm font-medium text-[#3D3831]">¿Qué tipo de unidad te interesa?</label>
          <select
            id="hw-interest" value={form.interest}
            onChange={e => setForm({ ...form, interest: e.target.value })}
            className="mt-1 w-full rounded-none border border-[#E2DBD0] bg-[#FAF8F4] px-4 py-3 outline-none focus:border-[#C5A572]"
          >
            <option value="">Selecciona una opción</option>
            {INTERESTS.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-[#3D3831]">¿Cómo prefieres la cita?</legend>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {([["PHONE", "Llamada", Phone], ["ZOOM", "Zoom", Video]] as const).map(([v, label, Icon]) => (
              <button
                key={v} type="button" onClick={() => setMeetingType(v)} aria-pressed={meetingType === v}
                className={[
                  "flex items-center justify-center gap-2 rounded-none border px-4 py-3 text-sm font-medium transition",
                  meetingType === v
                    ? "border-[#C5A572] bg-[#F2EDE4] text-[#6B5423]"
                    : "border-[#E2DBD0] text-[#57514A] hover:border-[#C5A572]",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="hw-msg" className="text-sm font-medium text-[#3D3831]">¿Algo que Catherine deba saber? (opcional)</label>
          <textarea
            id="hw-msg" rows={3} value={form.message}
            onChange={e => setForm({ ...form, message: e.target.value })}
            placeholder="Ej: busco para invertir y rentar, o vivo fuera de Estados Unidos."
            className="mt-1 w-full rounded-none border border-[#E2DBD0] px-4 py-3 outline-none focus:border-[#C5A572]"
          />
        </div>

        {errors.submit && (
          <p className="rounded-none bg-red-50 px-4 py-3 text-sm text-red-700">{errors.submit}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-none bg-[#C5A572] px-6 py-4 text-base font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {submitting
            ? <><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Agendando…</>
            : "Confirmar mi cita con Catherine"}
        </button>
        <p className="text-center text-xs text-[#9A9289]">
          Sin compromiso. Catherine te atiende en español o inglés.
        </p>
      </div>
    </form>
  )
}
