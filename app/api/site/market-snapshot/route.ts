export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { fetchAreaStats } from "@/lib/bridge"

// Area-wide market stats from the MLS (all brokers), not just our own listings.
export async function GET(req: Request) {
  try {
    const city = new URL(req.url).searchParams.get("city") || "Miami"
    const stats = await fetchAreaStats(city)

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const dateFrom = thirtyDaysAgo.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase()
    const dateTo = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase()

    return NextResponse.json({
      dateRange: `${dateFrom} - ${dateTo}`,
      activeListings: stats.activeListings,
      avgPrice: stats.avgPrice,
      avgDaysOnMarket: stats.avgDaysOnMarket,
    })
  } catch (e) {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
