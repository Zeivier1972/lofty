export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { decayAllScores } from "@/lib/scoring"

// Called by Railway cron or external scheduler
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const updated = await decayAllScores()
  return NextResponse.json({ updated })
}
