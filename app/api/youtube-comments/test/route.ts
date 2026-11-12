export const dynamic = "force-dynamic"
export const maxDuration = 120

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { answerYouTubeComments } from "@/lib/youtube-comments"

// POST /api/youtube-comments/test — the "Probar Sofía en YouTube" button.
// Reads the last 30 days of comments and writes what Sofía would answer
// (up to 5 replies), without posting anything to YouTube.
export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    return NextResponse.json(await answerYouTubeComments({ dryRun: true, maxAgeDays: 30, maxReplies: 5 }))
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
