export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const DEFAULT_SCHEDULE = [
  { dayOfWeek: 0, startTime: "09:00", endTime: "17:00", isAvailable: false, slotMinutes: 30 },
  { dayOfWeek: 1, startTime: "09:00", endTime: "17:00", isAvailable: true,  slotMinutes: 30 },
  { dayOfWeek: 2, startTime: "09:00", endTime: "17:00", isAvailable: true,  slotMinutes: 30 },
  { dayOfWeek: 3, startTime: "09:00", endTime: "17:00", isAvailable: true,  slotMinutes: 30 },
  { dayOfWeek: 4, startTime: "09:00", endTime: "17:00", isAvailable: true,  slotMinutes: 30 },
  { dayOfWeek: 5, startTime: "09:00", endTime: "17:00", isAvailable: true,  slotMinutes: 30 },
  { dayOfWeek: 6, startTime: "10:00", endTime: "14:00", isAvailable: false, slotMinutes: 30 },
]

export async function GET() {
  try {
    const session = await auth()
    const userId = session?.user?.id

    let rows = await prisma.availability.findMany({
      where: userId ? { userId } : {},
      orderBy: { dayOfWeek: "asc" },
    })

    // Seed defaults if none exist
    if (rows.length === 0 && userId) {
      rows = await Promise.all(
        DEFAULT_SCHEDULE.map(d =>
          prisma.availability.create({ data: { ...d, userId } })
        )
      )
    } else if (rows.length === 0) {
      return NextResponse.json(DEFAULT_SCHEDULE)
    }

    return NextResponse.json(rows)
  } catch (e) {
    return NextResponse.json(DEFAULT_SCHEDULE)
  }
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { schedule, blocks } = await req.json()
  const userId = session.user?.id

  try {
    // Upsert all 7 days
    if (schedule) {
      await prisma.availability.deleteMany({ where: { userId } })
      await prisma.availability.createMany({
        data: schedule.map((d: any) => ({ ...d, userId })),
      })
    }

    // Replace blocks if provided
    if (blocks !== undefined) {
      await prisma.availabilityBlock.deleteMany({ where: { userId } })
      if (blocks.length > 0) {
        await prisma.availabilityBlock.createMany({
          data: blocks.map((b: any) => ({ ...b, userId })),
        })
      }
    }

    const rows = await prisma.availability.findMany({
      where: { userId },
      orderBy: { dayOfWeek: "asc" },
    })
    return NextResponse.json(rows)
  } catch (e) {
    console.error("Availability update error:", e)
    return NextResponse.json({ error: "Failed to update availability" }, { status: 500 })
  }
}
