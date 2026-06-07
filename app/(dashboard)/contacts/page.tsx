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
  let tabCounts: Record<string, number> = {}
  const page = parseInt(searchParams.page || "1")
  const pageSize = 50
  const skip = (page - 1) * pageSize

  try {
    const baseWhere: any = { isArchived: false }
    const activeTab = searchParams.tab || "all"

    const tabWhere: any = { ...baseWhere }
    if (activeTab === "new_leads") {
      tabWhere.createdAt = { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    } else if (activeTab === "do_not_contact") {
      tabWhere.OR = [{ doNotCall: true }, { doNotEmail: true }, { doNotText: true }]
    } else if (activeTab === "contacted_1") {
      tabWhere.status = "PROSPECT"
    } else if (activeTab === "contacted_2") {
      tabWhere.status = "ACTIVE_CLIENT"
    } else if (activeTab === "buyers") {
      tabWhere.OR = [{ buyerBudgetMax: { not: null } }, { buyerLocation: { not: null } }]
    } else if (activeTab === "sellers") {
      tabWhere.OR = [{ sellerAddress: { not: null } }, { sellerEstimatedValue: { not: null } }]
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

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    ;[contacts, total, tags, tabCounts] = await Promise.all([
      prisma.contact.findMany({
        where: tabWhere,
        include: {
          tags: { include: { tag: true } },
          assignedTo: { select: { id: true, name: true } },
          pipelineLeads: { include: { stage: { include: { pipeline: true } } }, take: 1 },
          enrollments: { include: { plan: true }, take: 1 },
          _count: { select: { tasks: true, notes: true, activities: true } },
        },
        orderBy: [{ leadScore: "desc" }, { updatedAt: "desc" }],
        skip,
        take: pageSize,
      }),
      prisma.contact.count({ where: tabWhere }),
      prisma.tag.findMany({ orderBy: { name: "asc" } }),
      Promise.all([
        prisma.contact.count({ where: baseWhere }),
        prisma.contact.count({ where: { ...baseWhere, createdAt: { gte: sevenDaysAgo } } }),
        prisma.contact.count({ where: { ...baseWhere, OR: [{ doNotCall: true }, { doNotEmail: true }] } }),
        prisma.contact.count({ where: { ...baseWhere, status: "PROSPECT" } }),
        prisma.contact.count({ where: { ...baseWhere, status: "ACTIVE_CLIENT" } }),
        prisma.contact.count({ where: { ...baseWhere, OR: [{ buyerBudgetMax: { not: null } }, { buyerLocation: { not: null } }] } }),
        prisma.contact.count({ where: { ...baseWhere, OR: [{ sellerAddress: { not: null } }, { sellerEstimatedValue: { not: null } }] } }),
      ]).then(([all, newLeads, dnc, c1, c2, buyers, sellers]) => ({
        all, new_leads: newLeads, do_not_contact: dnc,
        contacted_1: c1, contacted_2: c2, buyers, sellers,
      })),
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
      tabCounts={tabCounts}
    />
  )
}
