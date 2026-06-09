export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { fetchListings, bridgeToProperty } from "@/lib/bridge"

export async function POST(req: Request) {
  const secret = req.headers.get("x-sync-secret")
  if (process.env.MLS_SYNC_SECRET && secret !== process.env.MLS_SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const cities = ["Miami", "Miami Beach", "Doral", "Kendall", "Coral Gables", "Aventura", "Sunny Isles Beach", "Hialeah", "Homestead"]
  let created = 0, updated = 0, errors = 0

  for (const city of cities) {
    try {
      const listings = await fetchListings({ city, limit: 50 })
      for (const listing of listings) {
        const data = bridgeToProperty(listing)
        if (!data.mlsId) continue
        try {
          const existing = await prisma.property.findFirst({ where: { mlsId: data.mlsId } })
          if (existing) {
            await prisma.property.update({ where: { id: existing.id }, data })
            updated++
          } else {
            await prisma.property.create({ data })
            created++
          }
        } catch { errors++ }
      }
    } catch (e) {
      console.error(`[MLS sync] Error fetching ${city}:`, e)
      errors++
    }
  }

  await prisma.property.updateMany({
    where: { status: "ACTIVE", updatedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    data: { status: "INACTIVE" },
  })

  return NextResponse.json({ success: true, created, updated, errors })
}

export async function GET() {
  const count = await prisma.property.count({ where: { status: "ACTIVE" } })
  return NextResponse.json({ activeListings: count })
}
