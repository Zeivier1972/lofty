export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import ContactsClient from "./contacts-client"

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: { status?: string; search?: string; source?: string; page?: string }
}) {
  let contacts: any[] = []
  let total = 0
  let tags: any[] = []
  const page = parseInt(searchParams.page || "1")
  const pageSize = 20
  const skip = (page - 1) * pageSize

  try {
    const where: any = { isArchived: false }
    if (searchParams.status) where.status = searchParams.status
    if (searchParams.source) where.source = searchParams.source
    if (searchParams.search) {
      where.OR = [
        { firstName: { contains: searchParams.search } },
        { lastName: { contains: searchParams.search } },
        { email: { contains: searchParams.search } },
        { phone: { contains: searchParams.search } },
      ]
    }

    ;[contacts, total, tags] = await Promise.all([
      prisma.contact.findMany({
        where,
        include: {
          tags: { include: { tag: true } },
          assignedTo: { select: { id: true, name: true } },
          _count: { select: { tasks: true, notes: true, activities: true } },
        },
        orderBy: [{ leadScore: "desc" }, { updatedAt: "desc" }],
        skip,
        take: pageSize,
      }),
      prisma.contact.count({ where }),
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
    />
  )
}
