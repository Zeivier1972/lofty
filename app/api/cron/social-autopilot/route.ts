export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { runAutopilot, checkHeygenVideos, triggerVideoOnly, publishBlogPostOnly } from "@/lib/social-autopilot"
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
  // "check"  = only poll HeyGen for completed videos, don't post new content
  // "video"  = only trigger HeyGen video generation, no social posts
  // "blog"   = only publish one blog post, no social posts
  const checkOnly = slotParam === "check"
  const videoOnly = slotParam === "video"
  const blogOnly  = slotParam === "blog"
  const slot = slotParam === "evening" ? "evening" : "morning"

  // Always respect the master on/off toggle (blog and video slots must also honour it)
  if (!checkOnly) {
    const { prisma: db } = await import("@/lib/prisma")
    const config = await db.socialAutoPilotConfig.findFirst()
    if (!config?.isEnabled) {
      console.log("[cron/social-autopilot] Auto-pilot is disabled — skipping all slots")
      return NextResponse.json({ ok: true, skipped: true, reason: "autopilot_disabled", slot: slotParam })
    }
  }

  // blog-only mode: publish today's blog post without any social posts
  if (blogOnly) {
    try {
      const result = await publishBlogPostOnly()
      return NextResponse.json({ ok: result.ok, blog: result, timestamp: new Date().toISOString() })
    } catch (err) {
      return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
    }
  }

  // video-only mode: trigger HeyGen without creating any social posts
  if (videoOnly) {
    try {
      const result = await triggerVideoOnly()
      return NextResponse.json({ ok: !result.error, ...result, timestamp: new Date().toISOString() })
    } catch (err) {
      return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
    }
  }

  try {
    const videoResult = await checkHeygenVideos()
    const autopilotResult = checkOnly ? { posted: 0, failed: 0, videoQueued: 0, skipped: 0 } : await runAutopilot(slot)

    // Fetch the last 10 posts so failures show their error context
    const { prisma } = await import("@/lib/prisma")
    const recentPosts = await prisma.socialPost.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        platform: true,
        status: true,
        content: true,
        createdAt: true,
        externalId: true,
        errorMessage: true,
      },
    })

    return NextResponse.json({
      ok: true,
      slot,
      autopilot: autopilotResult,
      heygenVideos: videoResult,
      timestamp: new Date().toISOString(),
      recent_posts: recentPosts,
    })
  } catch (err) {
    console.error("[cron/social-autopilot] Fatal error:", err)
    return NextResponse.json({ ok: false, error: String(err), slot }, { status: 500 })
  }
}
