export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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

    const userId = session.user?.id

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
        ...(contactId && { contactId }),
        ...(userId && { userId }),
      },
      include: { contact: { select: { id: true, firstName: true, lastName: true, phone: true } } },
    })

    if (contactId) {
      await prisma.activity.create({
        data: {
          type: "APPOINTMENT_SCHEDULED",
          title: `Cita agendada: ${title}`,
          description: description || "",
          contactId,
          ...(userId && { userId }),
        },
      })
    }

    return NextResponse.json(appointment)
  } catch (e) {
    console.error("[appointments POST]", e)
    return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 })
  }
}
