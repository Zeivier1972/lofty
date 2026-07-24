export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// Returns the connected Facebook Page ID + Instagram handle so the UI can build
// one-tap "comment/DM the keyword" deep links (m.me / ig.me) for any campaign.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [fb, ig] = await Promise.all([
    prisma.socialAccount.findFirst({ where: { platform: "FACEBOOK", isConnected: true }, select: { pageId: true, accountName: true } }).catch(() => null),
    prisma.socialAccount.findFirst({ where: { platform: "INSTAGRAM", isConnected: true }, select: { pageId: true, accountName: true } }).catch(() => null),
  ])

  const fbPageId = fb?.pageId || process.env.FACEBOOK_PAGE_ID || ""
  // ig.me deep links use the username (no @, no spaces).
  const igHandle = (ig?.accountName || "").trim().replace(/^@/, "").replace(/\s+/g, "")

  return NextResponse.json({ fbPageId, igHandle })
}
