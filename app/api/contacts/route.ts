export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { triggerMatchAlert } from "@/lib/trigger-match-alert"

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search")
    const status = searchParams.get("status")
    const tagsParam = searchParams.get("tags")
    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = parseInt(searchParams.get("pageSize") || "20")

    const where: any = { isArchived: false }
    if (status) where.status = status
    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ]
    }
    if (tagsParam) {
      const tagIds = tagsParam.split(",").filter(Boolean)
      if (tagIds.length > 0) where.tags = { some: { tagId: { in: tagIds } } }
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        include: { tags: { include: { tag: true } } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.contact.count({ where }),
    ])

    return NextResponse.json({ contacts, total, page, pageSize })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const data = await req.json()
    const contact = await prisma.contact.create({
      data: { ...data, assignedToId: session?.user?.id },
    })

    await prisma.activity.create({
      data: {
        type: "CONTACT_CREATED",
        title: "Contact created",
        contactId: contact.id,
        userId: session?.user?.id,
      },
    })

    // Ensure portal access exists for match-alert emails
    await prisma.clientPortalAccess.create({ data: { contactId: contact.id } }).catch(() => {})

    // If buyer prefs are set on creation, send immediate match alert
    if (contact.buyerBudgetMax || contact.buyerLocation || contact.buyerBedroomsMin) {
      triggerMatchAlert(contact.id).catch(() => {})
    }

    return NextResponse.json(contact, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: "Failed to create contact" }, { status: 500 })
  }
}
