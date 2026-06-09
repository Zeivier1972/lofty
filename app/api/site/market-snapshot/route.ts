export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [active, stats, recentStats] = await Promise.all([
      prisma.property.count({ where: { status: "ACTIVE" } }),
      prisma.property.aggregate({
        where: { status: "ACTIVE" },
        _avg: { price: true, daysOnMarket: true },
        _min: { price: true },
        _max: { price: true },
      }),
      prisma.property.aggregate({
        where: {
          status: "ACTIVE",
          listingDate: { gte: thirtyDaysAgo },
        },
        _count: true,
        _avg: { price: true, daysOnMarket: true },
      }),
    ])

    const dateFrom = thirtyDaysAgo.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase()
    const dateTo   = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase()

    return NextResponse.json({
      dateRange: `${dateFrom} - ${dateTo}`,
      activeListings: active,
      avgPrice: stats._avg.price ? Math.round(stats._avg.price) : null,
      avgDaysOnMarket: stats._avg.daysOnMarket ? Math.round(stats._avg.daysOnMarket) : null,
      minPrice: stats._min.price,
      maxPrice: stats._max.price,
      newListings30d: recentStats._count,
    })
  } catch (e) {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
