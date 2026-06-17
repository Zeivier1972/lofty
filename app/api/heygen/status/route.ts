export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.HEYGEN_API_KEY) {
    return NextResponse.json({ error: "HEYGEN_API_KEY not configured" }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const videoId = searchParams.get("videoId")
  if (!videoId) return NextResponse.json({ error: "videoId required" }, { status: 400 })

  const res = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
    headers: { "X-Api-Key": process.env.HEYGEN_API_KEY },
  })
  const data = await res.json()
  return NextResponse.json(data)
}
