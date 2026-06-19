export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getPortalSession } from "@/lib/portal-auth"

export async function POST(req: Request) {
  const session = await getPortalSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { propertyId, type } = await req.json()
  if (!propertyId || !type) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

  const contact = await prisma.contact.findUnique({
    where: { id: session.contactId },
    select: { id: true, firstName: true, lastName: true },
  })
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, address: true, city: true, price: true },
  })
  if (!property) return NextResponse.json({ error: "Property not found" }, { status: 404 })

  if (type === "SAVE") {
    const existing = await prisma.propertySave.findUnique({
      where: { contactId_propertyId: { contactId: session.contactId, propertyId } },
    })

    if (!existing) {
      await prisma.propertySave.create({
        data: { contactId: session.contactId, propertyId, aiTriggered: true, aiTriggeredAt: new Date() },
      })

      await prisma.aINotification.create({
        data: {
          type: "HOT_ALERT",
          title: `🔥 Hot Alert: ${contact.firstName} ${contact.lastName} saved a property!`,
          body: `${contact.firstName} saved ${property.address}, ${property.city} — $${property.price.toLocaleString()}. This could be a great time to reach out!`,
          priority: "HIGH",
          contactId: session.contactId,
          metadata: JSON.stringify({ propertyId, propertyAddress: property.address, action: "SAVED" }),
        },
      })

      await prisma.activity.create({
        data: {
          type: "PROPERTY_SAVED",
          title: `Client saved property via AI match`,
          description: `${property.address}, ${property.city}`,
          contactId: session.contactId,
        },
      })
    }

    return NextResponse.json({ saved: true })
  }

  if (type === "UNSAVE") {
    await prisma.propertySave.deleteMany({
      where: { contactId: session.contactId, propertyId },
    })
    return NextResponse.json({ saved: false })
  }

  if (type === "VIEW") {
    await prisma.propertyView.create({
      data: { contactId: session.contactId, propertyId },
    })

    // Count views — fire alert on 2nd view if not already triggered
    const viewCount = await prisma.propertyView.count({
      where: { contactId: session.contactId, propertyId },
    })

    if (viewCount === 2) {
      await prisma.aINotification.create({
        data: {
          type: "HOT_ALERT",
          title: `🔥 Hot Alert: ${contact.firstName} viewed a property twice!`,
          body: `${contact.firstName} ${contact.lastName} has viewed ${property.address}, ${property.city} ($${property.price.toLocaleString()}) twice. Strong interest signal — consider reaching out!`,
          priority: "HIGH",
          contactId: session.contactId,
          metadata: JSON.stringify({ propertyId, propertyAddress: property.address, action: "VIEWED_2X" }),
        },
      })
    }

    return NextResponse.json({ viewed: true, count: viewCount })
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 })
}
