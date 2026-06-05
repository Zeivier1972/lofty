"use client"

import { useState } from "react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday, addMonths, subMonths } from "date-fns"
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn, getStatusColor, APPOINTMENT_TYPES } from "@/lib/utils"

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

export default function CalendarClient({ appointments }: CalendarClientProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPadding = getDay(monthStart)

  const getAppointmentsForDay = (day: Date) =>
    appointments.filter((apt) => isSameDay(new Date(apt.startTime), day))

  const selectedDayAppointments = selectedDay
    ? getAppointmentsForDay(selectedDay)
    : []

  const todayAppointments = appointments.filter((apt) => isToday(new Date(apt.startTime)))

  return (
    <div className="p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {appointments.length} appointments this month
          </p>
        </div>
        <Button size="sm" className="bg-lofty-600 hover:bg-lofty-700 gap-2">
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
                  <Button size="sm" variant="outline" className="h-7 gap-1">
                    <Plus className="w-3 h-3" /> Add
                  </Button>
                </div>

                {selectedDayAppointments.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No appointments</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayAppointments.map((apt) => (
                      <div key={apt.id} className={cn("p-3 rounded-lg border", TYPE_COLORS[apt.type] || "bg-gray-50 border-gray-200")}>
                        <p className="text-sm font-medium">{apt.title}</p>
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
                      <div>
                        <p className="text-sm font-medium text-gray-800 leading-snug">{apt.title}</p>
                        <p className="text-xs text-gray-400">{format(new Date(apt.startTime), "h:mm a")}</p>
                        {apt.contact && (
                          <p className="text-xs text-lofty-600">{apt.contact.firstName} {apt.contact.lastName}</p>
                        )}
                      </div>
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
