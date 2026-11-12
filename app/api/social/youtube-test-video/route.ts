export const dynamic = "force-dynamic"
export const maxDuration = 120

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { triggerVideoOnly } from "@/lib/social-autopilot"

// POST /api/social/youtube-test-video — "Video de prueba" on Social → Accounts.
// Makes one avatar video (HeyGen, Catherine's chosen look) with this week's
// script and uploads it to YouTube UNLISTED once it renders (the hourly
// social-autopilot check publishes it). Works even with automatic videos off.
export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const r = await triggerVideoOnly({ test: true })
  return NextResponse.json(r, { status: r.error ? 400 : 200 })
}
