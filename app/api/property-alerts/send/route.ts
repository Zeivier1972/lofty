export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    // Find buyers with search criteria and active email
    const buyers = await prisma.contact.findMany({
      where: {
        OR: [
          { buyerBudgetMax: { not: null } },
          { buyerLocation: { not: null } },
        ],
        doNotEmail: false,
        email: { not: null },
      },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        buyerBudgetMin: true, buyerBudgetMax: true,
        buyerBedroomsMin: true, buyerPropertyType: true, buyerLocation: true,
      },
    })

    // Find active properties added in last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const newProperties = await prisma.property.findMany({
      where: { status: "ACTIVE", createdAt: { gte: since } },
    })

    // For each buyer, find matching properties and create Activity records
    let alertCount = 0
    const userId = session.user?.id

    for (const buyer of buyers) {
      const matches = newProperties.filter(p => {
        if (buyer.buyerBudgetMax && p.price > buyer.buyerBudgetMax) return false
        if (buyer.buyerBudgetMin && p.price < buyer.buyerBudgetMin) return false
        if (buyer.buyerBedroomsMin && (p.bedrooms || 0) < buyer.buyerBedroomsMin) return false
        if (buyer.buyerLocation) {
          const loc = buyer.buyerLocation.toLowerCase()
          const addr = `${p.address} ${p.city} ${p.state}`.toLowerCase()
          if (!addr.includes(loc) && !loc.split(",")[0].trim().split(" ").some((w: string) => addr.includes(w))) return false
        }
        return true
      })

      if (matches.length === 0) continue

      // Log as Activity (EMAIL type)
      await prisma.activity.create({
        data: {
          type: "EMAIL",
          title: `Property Alert: ${matches.length} new listing${matches.length > 1 ? "s" : ""} match your criteria`,
          description: matches.map(p => `${p.address}, ${p.city} — $${p.price.toLocaleString()}`).join("\n"),
          contactId: buyer.id,
          ...(userId && { userId }),
        },
      })
      alertCount++
    }

    return NextResponse.json({ success: true, count: alertCount })
  } catch (e) {
    console.error("Property alerts send error:", e)
    return NextResponse.json({ error: "Failed to send alerts" }, { status: 500 })
  }
}
