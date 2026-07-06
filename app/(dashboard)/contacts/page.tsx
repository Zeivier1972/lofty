export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import ContactsClient from "./contacts-client"

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: { status?: string; search?: string; source?: string; page?: string; tab?: string; tags?: string; smartPlanId?: string; smartPlanEnrolled?: string }
}) {
  let contacts: any[] = []
  let total = 0
  let tags: any[] = []
  let smartPlans: any[] = []
  let stageCounts: Record<string, number> = {}
  let stages: any[] = []
  let pipelineId = ""
  const page = parseInt(searchParams.page || "1")
  const pageSize = 50
  const skip = (page - 1) * pageSize

  try {
    // Fetch (or auto-seed) the default pipeline
    let defaultPipeline = await prisma.pipeline.findFirst({
      where: { isDefault: true },
      include: { stages: { orderBy: { order: "asc" } } },
    })

    if (!defaultPipeline) {
      defaultPipeline = await prisma.pipeline.create({
        data: {
          name: "Sales Pipeline",
          isDefault: true,
          stages: {
            create: [
              { name: "New Leads", color: "#6366F1", order: 0 },
              { name: "Contacted 1", color: "#3B82F6", order: 1 },
              { name: "Contacted 2", color: "#F59E0B", order: 2 },
              { name: "Contacted 3", color: "#10B981", order: 3 },
              { name: "Contacted 4", color: "#22C55E", order: 4 },
            ],
          },
        },
        include: { stages: { orderBy: { order: "asc" } } },
      })
    }

    stages = defaultPipeline.stages
    pipelineId = defaultPipeline.id

    const baseWhere: any = { isArchived: false }
    const activeTab = searchParams.tab || "all"

    const tabWhere: any = { ...baseWhere }
    // If activeTab is a stageId (not "all"), filter contacts in that stage
    if (activeTab !== "all") {
      tabWhere.pipelineLeads = { some: { stageId: activeTab } }
    }

    if (searchParams.source) tabWhere.source = searchParams.source
    if (searchParams.search) {
      const q = searchParams.search.trim()
      const or: any[] = [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { phone2: { contains: q } },
      ]

      // Full-name search: "Maria Garcia" → first AND last (both orders)
      const parts = q.split(/\s+/).filter(Boolean)
      if (parts.length >= 2) {
        const first = parts[0]
        const rest = parts.slice(1).join(" ")
        or.push({ AND: [
          { firstName: { contains: first, mode: "insensitive" } },
          { lastName: { contains: rest, mode: "insensitive" } },
        ] })
        or.push({ AND: [
          { firstName: { contains: rest, mode: "insensitive" } },
          { lastName: { contains: first, mode: "insensitive" } },
        ] })
      }

      // Phone search that ignores formatting: "305-555-1234", "(305) 555 1234"
      // and "3055551234" all match regardless of how the number is stored.
      const digits = q.replace(/\D/g, "")
      if (digits.length >= 4) {
        try {
          const idRows = await prisma.$queryRaw<{ id: string }[]>`
            SELECT id FROM "Contact"
            WHERE regexp_replace(coalesce(phone, ''), '\D', '', 'g') LIKE ${"%" + digits + "%"}
               OR regexp_replace(coalesce(phone2, ''), '\D', '', 'g') LIKE ${"%" + digits + "%"}
            LIMIT 500
          `
          if (idRows.length > 0) or.push({ id: { in: idRows.map((r: { id: string }) => r.id) } })
        } catch (e) {
          console.error("Phone digit search failed:", e)
        }
      }

      tabWhere.OR = or
    }
    if (searchParams.tags) {
      const tagIds = searchParams.tags.split(",").filter(Boolean)
      if (tagIds.length > 0) tabWhere.tags = { some: { tagId: { in: tagIds } } }
    }
    if (searchParams.smartPlanId) {
      if (searchParams.smartPlanEnrolled === "false") {
        tabWhere.enrollments = { none: { planId: searchParams.smartPlanId, status: "ACTIVE" } }
      } else {
        tabWhere.enrollments = { some: { planId: searchParams.smartPlanId, status: "ACTIVE" } }
      }
    }

    // Count contacts per stage in a single grouped query (was one COUNT per stage)
    const stageCountRows = await prisma.$queryRaw<{ stageId: string; count: number }[]>`
      SELECT pl."stageId" AS "stageId", COUNT(DISTINCT pl."contactId")::int AS count
      FROM "PipelineLead" pl
      JOIN "Contact" c ON c.id = pl."contactId"
      WHERE c."isArchived" = false
      GROUP BY pl."stageId"
    `
    stages.forEach(s => { stageCounts[s.id] = 0 })
    stageCountRows.forEach((r: { stageId: string; count: number }) => { stageCounts[r.stageId] = r.count })

    ;[contacts, total, tags, smartPlans] = await Promise.all([
      prisma.contact.findMany({
        where: tabWhere,
        include: {
          tags: { include: { tag: true } },
          assignedTo: { select: { id: true, name: true } },
          pipelineLeads: { include: { stage: true }, take: 1, orderBy: { updatedAt: "desc" } },
          enrollments: { include: { plan: true }, take: 1 },
          _count: { select: { tasks: true, notes: true, activities: true, dialerCalls: true, emails: true } },
        },
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: pageSize,
      }),
      prisma.contact.count({ where: tabWhere }),
      prisma.tag.findMany({ orderBy: { name: "asc" } }),
      prisma.smartPlan.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ])
  } catch (e) {
    console.error("Contacts page error:", e)
  }

  return (
    <ContactsClient
      contacts={JSON.parse(JSON.stringify(contacts))}
      total={total}
      page={page}
      pageSize={pageSize}
      tags={JSON.parse(JSON.stringify(tags))}
      filters={{ status: searchParams.status, search: searchParams.search, source: searchParams.source, tags: searchParams.tags, smartPlanId: searchParams.smartPlanId, smartPlanEnrolled: searchParams.smartPlanEnrolled }}
      smartPlans={JSON.parse(JSON.stringify(smartPlans))}
      activeTab={searchParams.tab || "all"}
      stageCounts={stageCounts}
      stages={JSON.parse(JSON.stringify(stages))}
      pipelineId={pipelineId}
    />
  )
}
