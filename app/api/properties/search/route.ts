export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  const minPrice = searchParams.get("minPrice")
  const maxPrice = searchParams.get("maxPrice")
  const bedrooms = searchParams.get("bedrooms")
  const bathrooms = searchParams.get("bathrooms")
  const propertyType = searchParams.get("type")
  const location = searchParams.get("location")
  const status = searchParams.get("status") || "ACTIVE"

  const where: any = { status }
  if (minPrice || maxPrice) {
    where.price = {}
    if (minPrice) where.price.gte = parseFloat(minPrice)
    if (maxPrice) where.price.lte = parseFloat(maxPrice)
  }
  if (bedrooms) where.bedrooms = { gte: parseInt(bedrooms) }
  if (bathrooms) where.bathrooms = { gte: parseFloat(bathrooms) }
  if (propertyType) where.propertyType = propertyType
  if (location) {
    where.OR = [
      { city: { contains: location } },
      { state: { contains: location } },
      { zip: { contains: location } },
      { address: { contains: location } },
    ]
  }

  const properties = await prisma.property.findMany({
    where,
    orderBy: [{ listingDate: "desc" }, { createdAt: "desc" }],
    take: 50,
  })

  return NextResponse.json(properties)
}

export async function POST(req: Request) {
  // Track search behavior
  const body = await req.json()
  const { contactId, sessionId, query, minPrice, maxPrice, bedrooms, bathrooms, propertyType, location } = body

  const properties = await searchProperties({ minPrice, maxPrice, bedrooms, bathrooms, propertyType, location })

  // Log search behavior
  await prisma.searchBehavior.create({
    data: {
      contactId,
      sessionId,
      searchQuery: JSON.stringify(query || {}),
      minPrice: minPrice ? parseFloat(minPrice) : null,
      maxPrice: maxPrice ? parseFloat(maxPrice) : null,
      bedrooms: bedrooms ? parseInt(bedrooms) : null,
      bathrooms: bathrooms ? parseFloat(bathrooms) : null,
      propertyType,
      location,
      resultCount: properties.length,
    },
  })

  // Check if contact is actively searching (5+ searches this week)
  if (contactId) {
    const recentSearches = await prisma.searchBehavior.count({
      where: { contactId, createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600000) } },
    })

    if (recentSearches % 5 === 0 && recentSearches > 0) {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ai/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trigger: "SEARCH_BEHAVIOR",
          contactId,
          searchCriteria: { minPrice, maxPrice, bedrooms, location, propertyType },
        }),
      }).catch(() => {})
    }

    // Update lead score for active searching
    await prisma.contact.update({
      where: { id: contactId },
      data: { leadScore: { increment: 1 } },
    }).catch(() => {})
  }

  return NextResponse.json(properties)
}

async function searchProperties(params: any) {
  const where: any = { status: "ACTIVE" }
  if (params.minPrice || params.maxPrice) {
    where.price = {}
    if (params.minPrice) where.price.gte = parseFloat(params.minPrice)
    if (params.maxPrice) where.price.lte = parseFloat(params.maxPrice)
  }
  if (params.bedrooms) where.bedrooms = { gte: parseInt(params.bedrooms) }
  if (params.bathrooms) where.bathrooms = { gte: parseFloat(params.bathrooms) }
  if (params.propertyType) where.propertyType = params.propertyType
  if (params.location) {
    where.OR = [
      { city: { contains: params.location } },
      { state: { contains: params.location } },
      { zip: { contains: params.location } },
    ]
  }
  return prisma.property.findMany({ where, take: 50 })
}
