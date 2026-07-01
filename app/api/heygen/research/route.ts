export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { researchViralContent } from "@/lib/content-research"
import { generateVideoScript, generateShotList } from "@/lib/social-autopilot"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { prisma } = await import("@/lib/prisma")
  const dayOfWeek = new Date().getDay()

  // Fetch all keywords that already have guides so Claude picks a fresh one
  const existingGuides = await prisma.leadMagnet.findMany({ select: { keyword: true } })
  const usedKeywords = existingGuides.map((g: { keyword: string }) => g.keyword)

  try {
    const research = await researchViralContent(dayOfWeek)
    const script = await generateVideoScript(dayOfWeek, research, usedKeywords)
    // Separate filming guide — does NOT feed the PDF (guide uses `script` only)
    const shotList = await generateShotList(script, research.trendingTopic)
    return NextResponse.json({
      script,
      shotList,
      topic: research.trendingTopic,
      hook: research.viralHook,
      engagementAngle: research.engagementAngle,
      usedKeywords,
    })
  } catch {
    try {
      const script = await generateVideoScript(dayOfWeek, undefined, usedKeywords)
      const shotList = await generateShotList(script)
      return NextResponse.json({ script, shotList, usedKeywords })
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 })
    }
  }
}
