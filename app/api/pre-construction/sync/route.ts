export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { scrapeShowingNew, getChromiumPath } from "@/lib/showingnew-scraper"

const SCRAPED_KEY = "preconstruction_scraped"

// Admin-triggered sync (requires session auth, not cron secret)
export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const start = Date.now()
  const chromiumPath = getChromiumPath()
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

  return NextResponse.json({
    ok: true,
    count: communities.length,
    strategy,
    elapsedMs: Date.now() - start,
    chromiumPath: chromiumPath || null,
    errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
  })
}
