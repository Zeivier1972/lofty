export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function POST(req: Request) {
  const { propertyId, contactId, unsave } = await req.json()

  if (!propertyId || !contactId) {
    return NextResponse.json({ error: "Missing propertyId or contactId" }, { status: 400 })
  }

  if (unsave) {
    await prisma.propertySave.updateMany({
      where: { propertyId, contactId },
      data: { isActive: false },
    })
    return NextResponse.json({ saved: false })
  }

  const existing = await prisma.propertySave.findUnique({
    where: { contactId_propertyId: { contactId, propertyId } },
  })

  if (existing) {
    await prisma.propertySave.update({
      where: { contactId_propertyId: { contactId, propertyId } },
      data: { isActive: true },
    })
  } else {
    await prisma.propertySave.create({
      data: { contactId, propertyId },
    })
  }

  // Log property interest
  await prisma.propertyInterest.upsert({
    where: { id: `${contactId}-${propertyId}-FAVORITED` },
    update: {},
    create: { id: `${contactId}-${propertyId}-FAVORITED`, contactId, propertyId, type: "FAVORITED" },
  }).catch(() => {})

  // Log activity
  const property = await prisma.property.findUnique({ where: { id: propertyId } })
  if (property) {
    await prisma.activity.create({
      data: {
        type: "PROPERTY_VIEWED",
        title: `Saved property: ${property.address}`,
        contactId,
      },
    })
  }

  // Update lead score
  await prisma.contact.update({
    where: { id: contactId },
    data: { leadScore: { increment: 10 } },
  }).catch(() => {})

  // Trigger AI agent (non-blocking)
  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ai/trigger`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trigger: "PROPERTY_SAVED", contactId, propertyId }),
  }).catch(() => {})

  return NextResponse.json({ saved: true })
}
