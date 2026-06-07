"use client"

import { useState, useEffect } from "react"
import {
  ChevronLeft, ChevronRight, Calendar, Clock, User, Mail,
  Phone, MessageSquare, CheckCircle2, Loader2, Home,
} from "lucide-react"
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday, isBefore, startOfDay } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"

const TOPICS = [
  { value: "Comprar una propiedad", label: "🏠 Quiero comprar una propiedad" },
  { value: "Vender mi propiedad", label: "💰 Quiero vender mi propiedad" },
  { value: "Comprador primera vez", label: "🎓 Soy comprador de primera vez" },
  { value: "Inversión inmobiliaria", label: "📈 Inversión inmobiliaria" },
  { value: "Pre-calificación", label: "📋 Pre-calificación hipotecaria" },
  { value: "Consulta general", label: "💬 Consulta general" },
]

const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

interface BookingClientProps {
  agentName: string
  agentTitle: string
}

export default function BookingClient({ agentName, agentTitle }: BookingClientProps) {
  const [step, setStep] = useState<"calendar" | "time" | "form" | "success">("calendar")
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [slots, setSlots] = useState<string[]>([])
  const [slotMinutes, setSlotMinutes] = useState(30)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    topic: "", message: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPadding = getDay(monthStart)
  const today = startOfDay(new Date())

  useEffect(() => {
    if (!selectedDate) return
    const dateStr = format(selectedDate, "yyyy-MM-dd")
    setLoadingSlots(true)
    setSlots([])
    setSelectedTime(null)
    fetch(`/api/appointments/slots?date=${dateStr}`)
      .then(r => r.json())
      .then(data => {
        setSlots(data.slots || [])
        setSlotMinutes(data.slotMinutes || 30)
        if ((data.slots || []).length > 0) setStep("time")
      })
      .finally(() => setLoadingSlots(false))
  }, [selectedDate])

  const handleDateClick = (day: Date) => {
    if (isBefore(day, today)) return
    setSelectedDate(day)
  }

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time)
    setStep("form")
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.firstName.trim()) e.firstName = "Requerido"
    if (!form.lastName.trim()) e.lastName = "Requerido"
    if (!form.email.trim() && !form.phone.trim()) e.email = "Email o teléfono requerido"
    if (!form.topic) e.topic = "Selecciona un tema"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
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
          ...form,
          type: "BUYER_CONSULTATION",
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStep("success")
    } catch (e: any) {
      setErrors({ submit: e.message || "Error al agendar. Por favor intenta de nuevo." })
    } finally {
      setSubmitting(false)
    }
  }

  const formatTime12 = (t: string) => {
    const [h, m] = t.split(":").map(Number)
    const ampm = h >= 12 ? "PM" : "AM"
    const h12 = h % 12 || 12
    return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Home className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm leading-tight">{agentName}</p>
            <p className="text-xs text-gray-500">{agentTitle}</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {step === "success" ? (
          /* ── Success ── */
          <div className="max-w-lg mx-auto text-center py-16 animate-fade-in">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">¡Cita Confirmada!</h1>
            <p className="text-gray-600 mb-2">
              Tu cita con <strong>{agentName}</strong> ha sido programada para el{" "}
              <strong>{selectedDate ? format(selectedDate, "EEEE, d 'de' MMMM", { locale: es }) : ""}</strong>{" "}
              a las <strong>{selectedTime ? formatTime12(selectedTime) : ""}</strong>.
            </p>
            <p className="text-gray-500 text-sm mb-8">
              {form.email
                ? `Hemos enviado una confirmación a ${form.email}.`
                : "Catherine se comunicará contigo pronto para confirmar los detalles."}
            </p>
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 text-left">
              <h3 className="font-semibold text-indigo-900 mb-3">¿Qué sigue?</h3>
              <ul className="space-y-2 text-sm text-indigo-700">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-500" />Catherine revisará tu cita y te contactará</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-500" />Recibirás el enlace de Zoom o número de teléfono</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-500" />La consulta es completamente gratuita</li>
              </ul>
            </div>
            <p className="text-xs text-gray-400 mt-6">
              Appointment confirmed — {agentName} will contact you soon with meeting details.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Agent info */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-6">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4">
                  <User className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">{agentName}</h2>
                <p className="text-gray-500 text-sm mb-4">{agentTitle}</p>
                <div className="space-y-2.5 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-400" />
                    <span>{slotMinutes} minutos por cita</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-400" />
                    <span>Teléfono o Zoom</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <span className="text-green-700 font-medium">Consulta gratuita</span>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Hablamos principalmente en español 🇪🇸 y también en inglés 🇺🇸
                  </p>
                </div>

                {/* Progress */}
                {step !== "calendar" && (
                  <div className="mt-6 pt-4 border-t border-gray-100 space-y-1.5">
                    {selectedDate && (
                      <div className="flex items-center gap-2 text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-gray-600">
                          {format(selectedDate, "EEEE, d MMM", { locale: es })}
                        </span>
                      </div>
                    )}
                    {selectedTime && (
                      <div className="flex items-center gap-2 text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-gray-600">{formatTime12(selectedTime)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Steps */}
            <div className="lg:col-span-2">
              {/* Title */}
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">
                  {step === "calendar" ? "Elige una fecha" :
                   step === "time" ? "Elige un horario" :
                   "Tus datos"}
                </h1>
                <p className="text-gray-500 text-sm mt-1">
                  {step === "calendar" ? "Selecciona el día que prefieras para tu consulta gratuita" :
                   step === "time" ? `Horarios disponibles para el ${selectedDate ? format(selectedDate, "EEEE d 'de' MMMM", { locale: es }) : ""}` :
                   "Solo toma un minuto. Nos comprometemos a no enviarte spam."}
                </p>
              </div>

              {/* STEP 1: Calendar */}
              {(step === "calendar" || step === "time") && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  {/* Month nav */}
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4 text-gray-600" />
                    </button>
                    <h3 className="font-semibold text-gray-900 capitalize">
                      {format(currentMonth, "MMMM yyyy", { locale: es })}
                    </h3>
                    <button
                      onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <ChevronRight className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>

                  {/* Day headers */}
                  <div className="grid grid-cols-7 mb-2">
                    {DAYS_ES.map(d => (
                      <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
                    ))}
                  </div>

                  {/* Days */}
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: startPadding }).map((_, i) => <div key={`pad-${i}`} />)}
                    {days.map(day => {
                      const isPast = isBefore(day, today)
                      const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
                      const isCurrentDay = isToday(day)
                      return (
                        <button
                          key={day.toISOString()}
                          onClick={() => !isPast && handleDateClick(day)}
                          disabled={isPast}
                          className={cn(
                            "aspect-square rounded-xl text-sm font-medium transition-all flex items-center justify-center",
                            isPast && "text-gray-300 cursor-not-allowed",
                            !isPast && !isSelected && "text-gray-700 hover:bg-indigo-50 hover:text-indigo-700",
                            isCurrentDay && !isSelected && "ring-2 ring-indigo-300 text-indigo-600",
                            isSelected && "bg-indigo-600 text-white shadow-md"
                          )}
                        >
                          {format(day, "d")}
                        </button>
                      )
                    })}
                  </div>

                  {/* Loading slots */}
                  {loadingSlots && (
                    <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Buscando horarios disponibles...
                    </div>
                  )}

                  {/* Time slots — shown inline below calendar */}
                  {step === "time" && slots.length > 0 && !loadingSlots && (
                    <div className="mt-5 pt-4 border-t border-gray-100">
                      <p className="text-sm font-semibold text-gray-700 mb-3">Horarios disponibles</p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {slots.map(slot => (
                          <button
                            key={slot}
                            onClick={() => handleTimeSelect(slot)}
                            className={cn(
                              "py-2.5 px-3 rounded-xl border text-sm font-medium transition-all",
                              selectedTime === slot
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                                : "border-gray-200 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                            )}
                          >
                            {formatTime12(slot)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {step === "time" && slots.length === 0 && !loadingSlots && (
                    <div className="mt-4 text-sm text-gray-500 text-center py-4">
                      No hay horarios disponibles para este día. Por favor elige otra fecha.
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: Form */}
              {step === "form" && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                  {/* Back button */}
                  <button
                    onClick={() => { setStep("time"); setSelectedTime(null) }}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-2"
                  >
                    <ChevronLeft className="w-4 h-4" /> Cambiar horario
                  </button>

                  {/* Selected slot summary */}
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-indigo-900 capitalize">
                        {selectedDate ? format(selectedDate, "EEEE, d 'de' MMMM yyyy", { locale: es }) : ""}
                      </p>
                      <p className="text-xs text-indigo-600">{selectedTime ? formatTime12(selectedTime) : ""} · {slotMinutes} min · Teléfono o Zoom</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Nombre *</label>
                      <input
                        value={form.firstName}
                        onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                        placeholder="María"
                        className={cn("w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none", errors.firstName ? "border-red-300" : "border-gray-300")}
                      />
                      {errors.firstName && <p className="text-xs text-red-500 mt-0.5">{errors.firstName}</p>}
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Apellido *</label>
                      <input
                        value={form.lastName}
                        onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                        placeholder="García"
                        className={cn("w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none", errors.lastName ? "border-red-300" : "border-gray-300")}
                      />
                      {errors.lastName && <p className="text-xs text-red-500 mt-0.5">{errors.lastName}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="maria@email.com"
                        className={cn("w-full border rounded-xl pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none", errors.email ? "border-red-300" : "border-gray-300")}
                      />
                    </div>
                    {errors.email && <p className="text-xs text-red-500 mt-0.5">{errors.email}</p>}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Teléfono</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="305-555-0100"
                        className="w-full border border-gray-300 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">¿Sobre qué quieres hablar? *</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {TOPICS.map(t => (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, topic: t.value }))}
                          className={cn(
                            "text-left px-3 py-2.5 border rounded-xl text-sm transition-all",
                            form.topic === t.value
                              ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-medium"
                              : "border-gray-200 text-gray-700 hover:border-indigo-200 hover:bg-indigo-50/50"
                          )}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    {errors.topic && <p className="text-xs text-red-500 mt-0.5">{errors.topic}</p>}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">
                      Mensaje (opcional)
                    </label>
                    <div className="relative">
                      <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <textarea
                        value={form.message}
                        onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                        placeholder="Cuéntanos un poco sobre lo que estás buscando..."
                        rows={3}
                        className="w-full border border-gray-300 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                      />
                    </div>
                  </div>

                  {errors.submit && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                      {errors.submit}
                    </div>
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-70 mt-2"
                  >
                    {submitting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Agendando...</>
                    ) : (
                      <><Calendar className="w-4 h-4" />Confirmar Cita</>
                    )}
                  </button>

                  <p className="text-xs text-center text-gray-400">
                    Al agendar, aceptas que {agentName} se ponga en contacto contigo.
                    Confirm Appointment — {agentName} will contact you with meeting details.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
