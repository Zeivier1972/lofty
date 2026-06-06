export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { runAIAgent } from "@/lib/ai-agent"

// This endpoint is called internally when behavioral triggers fire
export async function POST(req: Request) {
  const { trigger, contactId, propertyId, searchCriteria } = await req.json()

  const contact = await prisma.contact.findUnique({ where: { id: contactId } })
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 })

  let property = null
  if (propertyId) {
    property = await prisma.property.findUnique({ where: { id: propertyId } })
  }

  const recentSearches = await prisma.searchBehavior.count({
    where: { contactId, createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600000) } },
  })

  // Fire and forget — don't block the response
  runAIAgent({
    contact: {
      id: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      status: contact.status,
      leadScore: contact.leadScore,
      buyerBudgetMin: contact.buyerBudgetMin,
      buyerBudgetMax: contact.buyerBudgetMax,
      buyerLocation: contact.buyerLocation,
      buyerBedroomsMin: contact.buyerBedroomsMin,
    },
    trigger,
    property: property ? {
      id: property.id,
      address: property.address,
      city: property.city,
      state: property.state,
      price: property.price,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      sqft: property.sqft,
      images: property.images ?? undefined,
    } : undefined,
    searchCriteria,
    recentSearches,
  }).catch(console.error)

  return NextResponse.json({ success: true, message: "AI agent triggered" })
}
