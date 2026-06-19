export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getPortalSession } from "@/lib/portal-auth"

export async function GET() {
  const session = await getPortalSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const contact = await prisma.contact.findUnique({
    where: { id: session.contactId },
    select: {
      buyerBudgetMin: true,
      buyerBudgetMax: true,
      buyerBedroomsMin: true,
      buyerBathroomsMin: true,
      buyerPropertyType: true,
      buyerMustHaves: true,
      buyerLocation: true,
      buyerTimelineMonths: true,
      buyerPurpose: true,
      matchPrefsCompletedAt: true,
    },
  })

  return NextResponse.json(contact)
}

export async function POST(req: Request) {
  const session = await getPortalSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const data = await req.json()

  await prisma.contact.update({
    where: { id: session.contactId },
    data: {
      buyerBudgetMin: data.budgetMin != null ? Number(data.budgetMin) : null,
      buyerBudgetMax: data.budgetMax != null ? Number(data.budgetMax) : null,
      buyerBedroomsMin: data.bedroomsMin != null ? Number(data.bedroomsMin) : null,
      buyerBathroomsMin: data.bathroomsMin != null ? Number(data.bathroomsMin) : null,
      buyerPropertyType: data.propertyType || null,
      buyerMustHaves: JSON.stringify(data.mustHaves || []),
      buyerLocation: data.location || null,
      buyerTimelineMonths: data.timelineMonths != null ? Number(data.timelineMonths) : null,
      buyerPurpose: data.purpose || null,
      matchPrefsCompletedAt: new Date(),
    },
  })

  await prisma.activity.create({
    data: {
      type: "PREFERENCES_UPDATED",
      title: "Client completed AI match preferences",
      contactId: session.contactId,
    },
  })

  return NextResponse.json({ success: true })
}
