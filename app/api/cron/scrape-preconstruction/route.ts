export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { scrapeShowingNew } from "@/lib/showingnew-scraper"

const SCRAPED_KEY = "preconstruction_scraped"

// Called nightly by Railway cron: GET /api/cron/scrape-preconstruction
// Also callable manually from the Pre-Construction admin page
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const start = Date.now()
  console.log("[Cron] Starting ShowingNew scrape...")

  const { communities, errors, strategy } = await scrapeShowingNew()

  const payload = {
    communities,
    scrapedAt: new Date().toISOString(),
    strategy,
    count: communities.length,
  }

  await prisma.setting.upsert({
    where: { key: SCRAPED_KEY },
    update: { value: JSON.stringify(payload) },
    create: { key: SCRAPED_KEY, value: JSON.stringify(payload) },
  })

  const elapsed = Date.now() - start
  console.log(`[Cron] ShowingNew scrape done: ${communities.length} communities in ${elapsed}ms`)

  return NextResponse.json({
    ok: true,
    count: communities.length,
    strategy,
    elapsedMs: elapsed,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
  })
}
