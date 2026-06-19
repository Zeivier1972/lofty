export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { researchViralContent } from "@/lib/content-research"
import { generateVideoScript } from "@/lib/social-autopilot"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dayOfWeek = new Date().getDay()

  try {
    const research = await researchViralContent(dayOfWeek)
    const script = await generateVideoScript(dayOfWeek, research)
    return NextResponse.json({
      script,
      topic: research.trendingTopic,
      hook: research.viralHook,
      engagementAngle: research.engagementAngle,
    })
  } catch {
    try {
      const script = await generateVideoScript(dayOfWeek)
      return NextResponse.json({ script })
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 })
    }
  }
}
