export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import AdvisorClient from "./advisor-client"

export default async function InvestmentAdvisorPage() {
  let contacts: any[] = []
  let allTags: string[] = []
  try {
    const [rawContacts, tags] = await Promise.all([
      prisma.contact.findMany({
        select: {
          id: true, firstName: true, lastName: true, status: true,
          buyerBudgetMin: true, buyerBudgetMax: true, buyerLocation: true, buyerPurpose: true,
          tags: { select: { tag: { select: { name: true } } } },
        },
        orderBy: { leadScore: "desc" },
        take: 500,
      }),
      prisma.tag.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    ])
    contacts = rawContacts.map(c => ({
      ...c,
      tags: (c.tags || []).map((t: any) => t.tag?.name).filter(Boolean),
    }))
    allTags = tags.map(t => t.name)
  } catch {}

  return <AdvisorClient contacts={JSON.parse(JSON.stringify(contacts))} allTags={allTags} />
}
