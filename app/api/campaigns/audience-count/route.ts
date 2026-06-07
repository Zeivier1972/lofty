export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const audience = searchParams.get("audience") || "all"
  const tagsParam = searchParams.get("tags") || ""
  const tagIds = tagsParam ? tagsParam.split(",").filter(Boolean) : []

  const now = new Date()
  const base: any = { isArchived: false, doNotEmail: false, email: { not: null } }

  if (audience === "buyers") {
    base.OR = [{ buyerBudgetMax: { not: null } }, { buyerLocation: { not: null } }]
  } else if (audience === "sellers") {
    base.OR = [{ sellerAddress: { not: null } }, { sellerEstimatedValue: { not: null } }]
  } else if (audience === "new_leads") {
    base.createdAt = { gte: new Date(now.getTime() - 30 * 24 * 3600000) }
  } else if (audience === "cold") {
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 3600000)
    base.OR = [{ lastContacted: { lte: sixtyDaysAgo } }, { lastContacted: null }]
    base.createdAt = { lte: new Date(now.getTime() - 30 * 24 * 3600000) }
  } else if (audience === "no_plan") {
    base.enrollments = { none: { status: "ACTIVE" } }
  }

  if (tagIds.length > 0) {
    base.tags = { some: { tagId: { in: tagIds } } }
  }

  const count = await prisma.contact.count({ where: base })
  return NextResponse.json({ count })
}
