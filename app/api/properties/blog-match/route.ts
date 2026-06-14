export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const AUDIENCE_PRICE_RANGES: Record<string, { min?: number; max?: number }> = {
  luxury:     { min: 1_000_000 },
  investors:  { min: 300_000, max: 2_000_000 },
  buyers:     { min: 150_000, max: 800_000 },
  first_time: { min: 150_000, max: 450_000 },
  renters:    { min: 150_000, max: 450_000 },
  sellers:    {},
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { audience, tags } = await req.json()
  const range = AUDIENCE_PRICE_RANGES[audience] || {}

  const properties = await prisma.property.findMany({
    where: {
      status: "ACTIVE",
      ...(range.min !== undefined ? { price: { gte: range.min } } : {}),
      ...(range.max !== undefined ? { price: { lte: range.max } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: {
      id: true,
      mlsId: true,
      title: true,
      address: true,
      city: true,
      price: true,
      bedrooms: true,
      bathrooms: true,
      sqft: true,
      propertyType: true,
      images: true,
    },
  })

  const result = properties.map(p => ({
    ...p,
    images: (() => {
      try { return JSON.parse(p.images || "[]") } catch { return [] }
    })(),
  }))

  return NextResponse.json({ properties: result })
}
