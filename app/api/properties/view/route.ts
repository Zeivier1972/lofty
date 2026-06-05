import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const { propertyId, contactId, sessionId, durationSec } = await req.json()

  if (!propertyId) return NextResponse.json({ error: "Missing propertyId" }, { status: 400 })

  await prisma.propertyView.create({
    data: { propertyId, contactId, sessionId, durationSec },
  })

  // If contact has viewed this property 3+ times, trigger AI
  if (contactId) {
    const viewCount = await prisma.propertyView.count({
      where: { propertyId, contactId },
    })

    // Update lead score incrementally
    await prisma.contact.update({
      where: { id: contactId },
      data: { leadScore: { increment: 2 } },
    }).catch(() => {})

    if (viewCount === 3) {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ai/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "PROPERTY_VIEWED_3X", contactId, propertyId }),
      }).catch(() => {})
    }
  }

  return NextResponse.json({ success: true })
}
