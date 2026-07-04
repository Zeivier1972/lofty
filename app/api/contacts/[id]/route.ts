export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { sendCapiEvent } from "@/lib/facebook"
import { triggerMatchAlert } from "@/lib/trigger-match-alert"

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

    const prevContact = await prisma.contact.findUnique({
      where: { id: params.id },
      select: { status: true, email: true, phone: true, firstName: true, lastName: true, facebookLeadId: true, buyerBudgetMax: true, buyerLocation: true, buyerBedroomsMin: true },
    })

    const contact = await prisma.contact.update({
      where: { id: params.id },
      data: updateData,
    })

    // Fire Facebook CAPI events on meaningful status transitions
    if (updateData.status && updateData.status !== prevContact?.status) {
      const capiUser = { email: contact.email, phone: contact.phone, firstName: contact.firstName, lastName: contact.lastName, facebookLeadId: contact.facebookLeadId }
      if (updateData.status === "ACTIVE_CLIENT") {
        sendCapiEvent("Contact", capiUser, { eventId: `contact-${contact.id}` }).catch(() => {})
      } else if (updateData.status === "CLOSED" || updateData.status === "CLOSED_WON") {
        sendCapiEvent("Purchase", capiUser, { eventId: `purchase-${contact.id}` }).catch(() => {})
      }
    }

    await prisma.activity.create({
      data: {
        type: "CONTACT_UPDATED",
        title: "Contact updated",
        contactId: params.id,
        userId: session?.user?.id,
      },
    })

    // If buyer prefs were newly added/changed, trigger immediate match alert
    const hadPrefs = prevContact?.buyerBudgetMax || prevContact?.buyerLocation || prevContact?.buyerBedroomsMin
    const hasPrefs = contact.buyerBudgetMax || contact.buyerLocation || contact.buyerBedroomsMin
    if (hasPrefs && !hadPrefs) {
      triggerMatchAlert(params.id).catch(() => {})
    }

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
