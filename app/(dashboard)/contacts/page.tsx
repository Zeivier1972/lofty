export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import ContactsClient from "./contacts-client"

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: { status?: string; search?: string; source?: string; page?: string; tab?: string }
}) {
  let contacts: any[] = []
  let total = 0
  let tags: any[] = []
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
      tabWhere.OR = [
        { firstName: { contains: searchParams.search, mode: "insensitive" } },
        { lastName: { contains: searchParams.search, mode: "insensitive" } },
        { email: { contains: searchParams.search, mode: "insensitive" } },
        { phone: { contains: searchParams.search } },
      ]
    }

    // Count per stage in parallel
    const stageCountResults = await Promise.all(
      stages.map(s =>
        prisma.contact.count({ where: { ...baseWhere, pipelineLeads: { some: { stageId: s.id } } } })
      )
    )
    stages.forEach((s, i) => { stageCounts[s.id] = stageCountResults[i] })

    ;[contacts, total, tags] = await Promise.all([
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
      filters={{ status: searchParams.status, search: searchParams.search, source: searchParams.source }}
      activeTab={searchParams.tab || "all"}
      stageCounts={stageCounts}
      stages={JSON.parse(JSON.stringify(stages))}
      pipelineId={pipelineId}
    />
  )
}
