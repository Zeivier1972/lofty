"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday, addMonths, subMonths } from "date-fns"
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock, MapPin, X, Search, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn, APPOINTMENT_TYPES } from "@/lib/utils"

interface CalendarClientProps {
  appointments: any[]
}

const TYPE_COLORS: Record<string, string> = {
  SHOWING: "bg-blue-100 text-blue-700 border-blue-200",
  LISTING_APPOINTMENT: "bg-green-100 text-green-700 border-green-200",
  BUYER_CONSULTATION: "bg-purple-100 text-purple-700 border-purple-200",
  CLOSING: "bg-yellow-100 text-yellow-700 border-yellow-200",
  OPEN_HOUSE: "bg-orange-100 text-orange-700 border-orange-200",
  OTHER: "bg-gray-100 text-gray-700 border-gray-200",
}

const TYPES = [
  { value: "BUYER_CONSULTATION", label: "Buyer Consultation" },
  { value: "SHOWING", label: "Showing" },
  { value: "LISTING_APPOINTMENT", label: "Listing Appointment" },
  { value: "CLOSING", label: "Closing" },
  { value: "OPEN_HOUSE", label: "Open House" },
  { value: "OTHER", label: "Other" },
]

interface NewApptForm {
  contactQuery: string
  contactId: string
  contactName: string
  title: string
  type: string
  date: string
  startTime: string
  endTime: string
  location: string
  description: string
}

const emptyForm = (): NewApptForm => ({
  contactQuery: "",
  contactId: "",
  contactName: "",
  title: "",
  type: "BUYER_CONSULTATION",
  date: format(new Date(), "yyyy-MM-dd"),
  startTime: "09:00",
  endTime: "09:30",
  location: "",
  description: "",
})

function NewAppointmentModal({
  defaultDate,
  onClose,
  onCreated,
}: {
  defaultDate: Date | null
  onClose: () => void
  onCreated: (apt: any) => void
}) {
  const [form, setForm] = useState<NewApptForm>(() => ({
    ...emptyForm(),
    date: defaultDate ? format(defaultDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
  }))
  const [contactResults, setContactResults] = useState<any[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const searchTimer = useRef<NodeJS.Timeout | null>(null)

  const searchContacts = useCallback((q: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!q.trim()) { setContactResults([]); setShowDropdown(false); return }
    setSearching(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/contacts?search=${encodeURIComponent(q)}&pageSize=8`)
        const data = await res.json()
        setContactResults(data.contacts || [])
        setShowDropdown(true)
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [])

  const set = (k: keyof NewApptForm, v: string) => setForm(f => ({ ...f, [k]: v }))

  const pickContact = (c: any) => {
    const name = `${c.firstName} ${c.lastName}`.trim()
    setForm(f => ({
      ...f,
      contactId: c.id,
      contactName: name,
      contactQuery: name,
      title: f.title || `${f.type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())} — ${name}`,
    }))
    setShowDropdown(false)
  }

  const handleSubmit = async () => {
    if (!form.title || !form.date || !form.startTime || !form.endTime) {
      setError("Title, date, and times are required.")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          type: form.type,
          startTime: `${form.date}T${form.startTime}:00`,
          endTime: `${form.date}T${form.endTime}:00`,
          contactId: form.contactId || undefined,
          location: form.location || undefined,
          description: form.description || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onCreated(data)
    } catch (e: any) {
      setError(e.message || "Failed to create appointment.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">New Appointment</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Contact search */}
          <div className="relative">
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Contact (optional)</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={form.contactQuery}
                onChange={e => { set("contactQuery", e.target.value); set("contactId", ""); searchContacts(e.target.value) }}
                placeholder="Search by name, email, or phone…"
                className="w-full border border-gray-300 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />}
            </div>
            {showDropdown && contactResults.length > 0 && (
              <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {contactResults.map(c => (
                  <button
                    key={c.id}
                    onClick={() => pickContact(c)}
                    className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 transition-colors text-sm"
                  >
                    <span className="font-medium text-gray-900">{c.firstName} {c.lastName}</span>
                    {c.phone && <span className="text-gray-400 ml-2">{c.phone}</span>}
                    {c.email && <span className="text-gray-400 ml-2 text-xs">{c.email}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Type */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Type</label>
            <select
              value={form.type}
              onChange={e => set("type", e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            >
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Title *</label>
            <input
              value={form.title}
              onChange={e => set("title", e.target.value)}
              placeholder="e.g. Buyer Consultation — John Smith"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Date + Times */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3 sm:col-span-1">
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={e => set("date", e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Start *</label>
              <input
                type="time"
                value={form.startTime}
                onChange={e => set("startTime", e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">End *</label>
              <input
                type="time"
                value={form.endTime}
                onChange={e => set("endTime", e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Location</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={form.location}
                onChange={e => set("location", e.target.value)}
                placeholder="Address or Zoom link"
                className="w-full border border-gray-300 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Notes</label>
            <textarea
              value={form.description}
              onChange={e => set("description", e.target.value)}
              placeholder="Additional details…"
              rows={2}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
          )}
        </div>

        <div className="px-6 pb-5 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</> : "Create Appointment"}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function CalendarClient({ appointments: initialAppointments }: CalendarClientProps) {
  const [appointments, setAppointments] = useState(initialAppointments)
  const [cancelling, setCancelling] = useState<string | null>(null)

  const cancelAppointment = async (id: string, title: string) => {
    if (!confirm(`Cancel "${title}"?`)) return
    setCancelling(id)
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      })
      if (!res.ok) throw new Error()
      setAppointments(prev => prev.filter(a => a.id !== id))
    } catch {
      alert("Failed to cancel appointment.")
    } finally { setCancelling(null) }
  }
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date())
  const [showModal, setShowModal] = useState(false)
  const [modalDefaultDate, setModalDefaultDate] = useState<Date | null>(null)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPadding = getDay(monthStart)

  const getAppointmentsForDay = (day: Date) =>
    appointments.filter((apt) => isSameDay(new Date(apt.startTime), day))

  const selectedDayAppointments = selectedDay ? getAppointmentsForDay(selectedDay) : []

  const openModal = (date: Date | null = null) => {
    setModalDefaultDate(date)
    setShowModal(true)
  }

  const handleCreated = (apt: any) => {
    setAppointments(prev => [...prev, apt])
    setShowModal(false)
    // Select the day of the new appointment
    setSelectedDay(new Date(apt.startTime))
    setCurrentMonth(new Date(apt.startTime))
  }

  return (
    <div className="p-6 animate-fade-in">
      {showModal && (
        <NewAppointmentModal
          defaultDate={modalDefaultDate}
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {appointments.length} appointments this month
          </p>
        </div>
        <Button size="sm" className="bg-lofty-600 hover:bg-lofty-700 gap-2" onClick={() => openModal(selectedDay)}>
          <Plus className="w-4 h-4" /> New Appointment
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Calendar grid */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900">
                  {format(currentMonth, "MMMM yyyy")}
                </h2>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())} className="h-8">Today</Button>
                  <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="text-center text-xs font-semibold text-gray-400 pb-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-px">
                {Array.from({ length: startPadding }).map((_, i) => (
                  <div key={`pad-${i}`} className="h-20 bg-gray-50 rounded-lg" />
                ))}

                {days.map((day) => {
                  const dayApts = getAppointmentsForDay(day)
                  const isSelected = selectedDay && isSameDay(day, selectedDay)
                  const today = isToday(day)

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDay(day)}
                      className={cn(
                        "h-20 p-1.5 rounded-lg text-left transition-all border",
                        isSelected ? "bg-lofty-50 border-lofty-300" : "bg-white hover:bg-gray-50 border-gray-100",
                      )}
                    >
                      <span
                        className={cn(
                          "w-6 h-6 flex items-center justify-center rounded-full text-sm font-medium",
                          today ? "bg-lofty-600 text-white" : "text-gray-700",
                        )}
                      >
                        {format(day, "d")}
                      </span>
                      <div className="mt-1 space-y-0.5">
                        {dayApts.slice(0, 2).map((apt) => (
                          <div
                            key={apt.id}
                            className={cn("text-xs px-1 py-0.5 rounded truncate", TYPE_COLORS[apt.type] || "bg-gray-100 text-gray-700")}
                          >
                            {format(new Date(apt.startTime), "h:mma")} {apt.title}
                          </div>
                        ))}
                        {dayApts.length > 2 && (
                          <div className="text-xs text-gray-400 px-1">+{dayApts.length - 2} more</div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          {/* Selected day */}
          {selectedDay && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">
                    {isToday(selectedDay) ? "Today" : format(selectedDay, "EEEE, MMM d")}
                  </h3>
                  <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => openModal(selectedDay)}>
                    <Plus className="w-3 h-3" /> Add
                  </Button>
                </div>

                {selectedDayAppointments.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No appointments</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayAppointments.map((apt) => (
                      <div key={apt.id} className={cn("p-3 rounded-lg border relative", TYPE_COLORS[apt.type] || "bg-gray-50 border-gray-200")}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-snug">{apt.title}</p>
                          <button
                            type="button"
                            onClick={() => cancelAppointment(apt.id, apt.title)}
                            disabled={cancelling === apt.id}
                            className="flex-shrink-0 opacity-50 hover:opacity-100 hover:text-red-600 transition-all p-0.5 rounded"
                            title="Cancel appointment"
                          >
                            {cancelling === apt.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <div className="flex items-center gap-1 text-xs mt-1 opacity-70">
                          <Clock className="w-3 h-3" />
                          {format(new Date(apt.startTime), "h:mm a")} – {format(new Date(apt.endTime), "h:mm a")}
                        </div>
                        {apt.location && (
                          <div className="flex items-center gap-1 text-xs mt-0.5 opacity-70">
                            <MapPin className="w-3 h-3" />
                            {apt.location}
                          </div>
                        )}
                        {apt.contact && (
                          <p className="text-xs mt-1 opacity-70">
                            {apt.contact.firstName} {apt.contact.lastName}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Upcoming */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Upcoming This Month</h3>
              <div className="space-y-2">
                {appointments
                  .filter((a) => new Date(a.startTime) >= new Date())
                  .slice(0, 6)
                  .map((apt) => (
                    <div key={apt.id} className="flex gap-3 items-start">
                      <div className="w-10 h-10 bg-lofty-50 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-lofty-700 leading-none">{format(new Date(apt.startTime), "d")}</span>
                        <span className="text-xs text-lofty-500 leading-none">{format(new Date(apt.startTime), "MMM")}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 leading-snug">{apt.title}</p>
                        <p className="text-xs text-gray-400">{format(new Date(apt.startTime), "h:mm a")}</p>
                        {apt.contact && (
                          <p className="text-xs text-lofty-600">{apt.contact.firstName} {apt.contact.lastName}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => cancelAppointment(apt.id, apt.title)}
                        disabled={cancelling === apt.id}
                        className="flex-shrink-0 text-gray-300 hover:text-red-500 transition-colors p-1 rounded"
                        title="Cancel"
                      >
                        {cancelling === apt.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ))}
                {appointments.filter((a) => new Date(a.startTime) >= new Date()).length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-2">No upcoming appointments</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
