export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { runAutopilot, checkHeygenVideos } from "@/lib/social-autopilot"

/**
 * GET /api/cron/social-autopilot?slot=morning|evening&secret=...
 *
 * Protected by CRON_SECRET query param (Railway cron doesn't support custom headers).
 * Also accepts Authorization: Bearer <secret> for manual testing.
 *
 * Railway cron schedules:
 *   0 13 * * *  →  ?slot=morning&secret={CRON_SECRET}    (9 AM ET = 13:00 UTC)
 *   0 22 * * *  →  ?slot=evening&secret={CRON_SECRET}    (6 PM ET = 22:00 UTC)
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret) {
    const { searchParams } = new URL(req.url)
    const querySecret = searchParams.get("secret")
    const authHeader = req.headers.get("authorization")

    const validHeader = authHeader === `Bearer ${cronSecret}`
    const validQuery = querySecret === cronSecret

    if (!validHeader && !validQuery) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const { searchParams } = new URL(req.url)
  const slotParam = searchParams.get("slot")
  const slot = slotParam === "evening" ? "evening" : "morning"

  try {
    // First, publish any completed HeyGen videos from previous runs
    const videoResult = await checkHeygenVideos()

    // Then run the autopilot for this slot
    const autopilotResult = await runAutopilot(slot)

    return NextResponse.json({
      ok: true,
      slot,
      autopilot: autopilotResult,
      heygenVideos: videoResult,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error("[cron/social-autopilot] Fatal error:", err)
    return NextResponse.json(
      { ok: false, error: String(err), slot },
      { status: 500 }
    )
  }
}
