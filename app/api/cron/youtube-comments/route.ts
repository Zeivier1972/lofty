export const dynamic = "force-dynamic"
export const maxDuration = 120

import { NextResponse } from "next/server"
import { answerYouTubeComments } from "@/lib/youtube-comments"

// GET /api/cron/youtube-comments — every 30 min from instrumentation.ts.
// Sofía answers new comments on Catherine's YouTube channel.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    return NextResponse.json(await answerYouTubeComments())
  } catch (e: any) {
    console.error("[youtube-comments]", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
