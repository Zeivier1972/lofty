export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { runAIAgent } from "@/lib/ai-agent"

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { firstName, lastName, email, phone, preApproved, notes } = await req.json()

  const visitor = await prisma.openHouseVisitor.create({
    data: {
      openHouseId: params.id,
      firstName,
      lastName,
      email: email || undefined,
      phone: phone || undefined,
      preApproved: preApproved || false,
      notes: notes || undefined,
    },
  })

  // Auto-create contact and fire AI agent follow-up
  if (email || phone) {
    const existing = await prisma.contact.findFirst({
      where: { OR: [email ? { email } : {}, phone ? { phone } : {}].filter(o => Object.keys(o).length > 0) },
    })

    let contact = existing
    if (!contact) {
      contact = await prisma.contact.create({
        data: { firstName, lastName, email, phone, source: "OPEN_HOUSE", status: "NEW_LEAD" },
      })
    }

    await prisma.openHouseVisitor.update({
      where: { id: visitor.id },
      data: { contactId: contact.id },
    })

    const openHouse = await prisma.openHouse.findUnique({
      where: { id: params.id },
      include: { property: true },
    })

    // Fire AI follow-up for open house visitor
    runAIAgent({
      contact: {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        status: contact.status,
        leadScore: contact.leadScore,
      },
      trigger: "open_house_visit",
      property: openHouse?.property ? {
        id: openHouse.property.id,
        address: openHouse.property.address,
        city: openHouse.property.city,
        state: openHouse.property.state,
        price: openHouse.property.price,
        bedrooms: openHouse.property.bedrooms,
        bathrooms: openHouse.property.bathrooms,
        sqft: openHouse.property.sqft,
        images: openHouse.property.images ?? undefined,
      } : undefined,
    }).catch(console.error)
  }

  return NextResponse.json(visitor, { status: 201 })
}
