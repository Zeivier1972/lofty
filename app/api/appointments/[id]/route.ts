export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { status } = await req.json()
    if (!status) return NextResponse.json({ error: "status required" }, { status: 400 })

    const appointment = await prisma.appointment.update({
      where: { id: params.id },
      data: { status },
      include: { contact: { select: { id: true, firstName: true, lastName: true } } },
    })

    if (status === "CANCELLED" && appointment.contactId) {
      await prisma.activity.create({
        data: {
          type: "NOTE",
          title: "Cita cancelada",
          description: appointment.title,
          contactId: appointment.contactId,
        },
      })
    }

    return NextResponse.json(appointment)
  } catch (e) {
    console.error("Appointment update error:", e)
    return NextResponse.json({ error: "Failed to update appointment" }, { status: 500 })
  }
}
