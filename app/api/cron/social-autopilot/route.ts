export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { runAutopilot, checkHeygenVideos } from "@/lib/social-autopilot"
import { auth } from "@/lib/auth"

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  const { searchParams } = new URL(req.url)
  const querySecret = searchParams.get("secret")
  const authHeader = req.headers.get("authorization")

  // Accept: valid CRON_SECRET (for instrumentation/Railway) OR logged-in session (for manual browser test)
  const validSecret =
    !cronSecret ||
    querySecret === cronSecret ||
    authHeader === `Bearer ${cronSecret}`

  if (!validSecret) {
    // Fall back to session auth so a logged-in user can trigger from the browser
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const slotParam = searchParams.get("slot")
  const slot = slotParam === "evening" ? "evening" : "morning"

  try {
    const videoResult = await checkHeygenVideos()
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
    return NextResponse.json({ ok: false, error: String(err), slot }, { status: 500 })
  }
}
