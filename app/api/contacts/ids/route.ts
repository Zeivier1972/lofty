export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

/**
 * GET /api/contacts/ids
 * Returns all contact IDs matching the given filter params (no pagination).
 * Used by "select all N contacts" global-select mode on the contacts page.
 */
export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search")
    const status = searchParams.get("status")
    const source = searchParams.get("source")
    const tagsParam = searchParams.get("tags")
    const smartPlanId = searchParams.get("smartPlanId")
    const smartPlanEnrolled = searchParams.get("smartPlanEnrolled")
    const tab = searchParams.get("tab")

    const where: any = { isArchived: false }
    if (status && status !== "ALL") where.status = status
    if (source && source !== "ALL") where.source = source
    if (tab && tab !== "all") where.pipelineLeads = { some: { stageId: tab } }
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ]
    }
    if (tagsParam) {
      const tagIds = tagsParam.split(",").filter(Boolean)
      if (tagIds.length > 0) where.tags = { some: { tagId: { in: tagIds } } }
    }
    if (smartPlanId) {
      where.enrollments = smartPlanEnrolled === "false"
        ? { none: { planId: smartPlanId, status: "ACTIVE" } }
        : { some: { planId: smartPlanId, status: "ACTIVE" } }
    }

    const contacts = await prisma.contact.findMany({
      where,
      select: { id: true },
    })

    return NextResponse.json({ ids: contacts.map(c => c.id), total: contacts.length })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
