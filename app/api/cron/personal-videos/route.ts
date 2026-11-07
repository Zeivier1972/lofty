export const dynamic = "force-dynamic"
export const maxDuration = 300

import { NextResponse } from "next/server"
import { processPersonalVideos } from "@/lib/personal-video"

/** Every 5 minutes: finished HeyGen renders → Cloudinary → sent to the lead. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const url = new URL(req.url)
    const ok = req.headers.get("authorization") === `Bearer ${secret}` ||
      req.headers.get("x-cron-secret") === secret || url.searchParams.get("secret") === secret
    if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const notes = await processPersonalVideos()
  return NextResponse.json({ ok: true, notes })
}
