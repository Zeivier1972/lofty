export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  try {
    const {
      title, type = "OTHER", startTime, endTime,
      contactId, location, description, virtualLink,
    } = await req.json()

    if (!title || !startTime || !endTime) {
      return NextResponse.json({ error: "title, startTime, and endTime are required" }, { status: 400 })
    }

    const start = new Date(startTime)
    const end = new Date(endTime)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: "Invalid date/time" }, { status: 400 })
    }

    if (end <= start) {
      return NextResponse.json({ error: "End time must be after start time" }, { status: 400 })
    }

    const agent = await prisma.user.findFirst({ where: { isActive: true } })

    const appointment = await prisma.appointment.create({
      data: {
        title,
        type,
        startTime: start,
        endTime: end,
        location: location || null,
        description: description || null,
        virtualLink: virtualLink || null,
        status: "SCHEDULED",
        ...(contactId ? { contactId } : {}),
        ...(agent ? { userId: agent.id } : {}),
      },
      include: { contact: { select: { id: true, firstName: true, lastName: true, phone: true } } },
    })

    if (contactId) {
      await prisma.activity.create({
        data: {
          type: "APPOINTMENT_SCHEDULED",
          title: `Cita agendada: ${title}`,
          description: description || null,
          contactId,
          ...(agent ? { userId: agent.id } : {}),
        },
      }).catch(() => {})
    }

    return NextResponse.json(appointment)
  } catch (e: any) {
    console.error("[appointments POST]", e)
    return NextResponse.json({ error: e?.message || "Failed to create appointment" }, { status: 500 })
  }
}
