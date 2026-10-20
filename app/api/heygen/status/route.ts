export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getVideoStatus } from "@/lib/heygen"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.HEYGEN_API_KEY) {
    return NextResponse.json({ error: "HEYGEN_API_KEY not configured" }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const videoId = searchParams.get("videoId")
  if (!videoId) return NextResponse.json({ error: "videoId required" }, { status: 400 })

  // Goes through lib/heygen so this follows HEYGEN_API_VERSION with everything
  // else; the raw payload is still returned for any caller reading its fields.
  const { status, videoUrl, raw } = await getVideoStatus(videoId)
  return NextResponse.json({ ...raw, status, video_url: videoUrl })
}
