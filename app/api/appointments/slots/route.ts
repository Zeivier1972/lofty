export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + m
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const dateStr = searchParams.get("date") // "YYYY-MM-DD"
  const userId = searchParams.get("userId")

  if (!dateStr) return NextResponse.json({ error: "date required" }, { status: 400 })

  const date = new Date(dateStr + "T00:00:00")
  const dayOfWeek = date.getDay()

  try {
    // Get availability for this day of week; fall back to default Mon–Sat 9am–6pm
    const avail = userId
      ? await prisma.availability.findFirst({ where: { userId, dayOfWeek } })
      : await prisma.availability.findFirst({ where: { dayOfWeek } })

    const DEFAULT_START = "09:00"
    const DEFAULT_END = "18:00"
    const isWeekend = dayOfWeek === 0 // Sunday closed by default

    if (isWeekend && !avail) {
      return NextResponse.json({ slots: [], message: "No disponible este día" })
    }

    if (!avail?.isAvailable) {
      return NextResponse.json({ slots: [], message: "No disponible este día" })
    }

    const effectiveAvail = avail ?? { startTime: DEFAULT_START, endTime: DEFAULT_END, slotMinutes: 30, isAvailable: true }

    // Get full-day blocks for this date
    const dayBlocks = await prisma.availabilityBlock.findMany({
      where: { date: dateStr, ...(userId && { userId }) },
    })
    const fullDayBlocked = dayBlocks.some(b => !b.startTime)
    if (fullDayBlocked) {
      return NextResponse.json({ slots: [], message: "Día bloqueado" })
    }

    // Get existing appointments for this date
    const dayStart = new Date(dateStr + "T00:00:00")
    const dayEnd = new Date(dateStr + "T23:59:59")
    const bookedAppointments = await prisma.appointment.findMany({
      where: {
        startTime: { gte: dayStart, lte: dayEnd },
        status: { not: "CANCELLED" },
        ...(userId && { userId }),
      },
      select: { startTime: true, endTime: true },
    })

    // Generate all possible slots
    const startMin = timeToMinutes(effectiveAvail.startTime)
    const endMin = timeToMinutes(effectiveAvail.endTime)
    const slotMins = effectiveAvail.slotMinutes || 30

    const slots: string[] = []
    for (let m = startMin; m + slotMins <= endMin; m += slotMins) {
      const slotStart = minutesToTime(m)
      const slotEnd = minutesToTime(m + slotMins)

      // Check against time blocks
      const blockedByTime = dayBlocks.some(b => {
        if (!b.startTime || !b.endTime) return false
        const bStart = timeToMinutes(b.startTime)
        const bEnd = timeToMinutes(b.endTime)
        return m < bEnd && m + slotMins > bStart
      })
      if (blockedByTime) continue

      // Check against booked appointments
      const slotDate = new Date(`${dateStr}T${slotStart}:00`)
      const slotEndDate = new Date(`${dateStr}T${slotEnd}:00`)
      const isBooked = bookedAppointments.some(apt => {
        const aptStart = new Date(apt.startTime)
        const aptEnd = new Date(apt.endTime)
        return slotDate < aptEnd && slotEndDate > aptStart
      })
      if (isBooked) continue

      // Skip past slots
      if (slotDate <= new Date()) continue

      slots.push(slotStart)
    }

    return NextResponse.json({ slots, slotMinutes: slotMins })
  } catch (e) {
    console.error("Slots error:", e)
    return NextResponse.json({ error: "Failed to get slots" }, { status: 500 })
  }
}
