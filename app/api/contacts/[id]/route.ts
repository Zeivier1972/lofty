export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const contact = await prisma.contact.findUnique({
      where: { id: params.id },
      include: {
        tags: { include: { tag: true } },
        notes: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
        tasks: { orderBy: { createdAt: "desc" } },
        activities: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    })

    if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(contact)
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const data = await req.json()
    const { id, assignedTo, tags, notes, tasks, activities, pipelineLeads, enrollments, propertyInterests, emails, appointments, transactions, _count, ...updateData } = data

    const contact = await prisma.contact.update({
      where: { id: params.id },
      data: updateData,
    })

    await prisma.activity.create({
      data: {
        type: "CONTACT_UPDATED",
        title: "Contact updated",
        contactId: params.id,
        userId: session?.user?.id,
      },
    })

    return NextResponse.json(contact)
  } catch {
    return NextResponse.json({ error: "Failed to update contact" }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    await prisma.contact.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete contact" }, { status: 500 })
  }
}
