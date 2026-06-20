export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import AdvisorClient from "./advisor-client"

export default async function InvestmentAdvisorPage() {
  let contacts: any[] = []
  try {
    contacts = await prisma.contact.findMany({
      select: {
        id: true, firstName: true, lastName: true, status: true,
        buyerBudgetMin: true, buyerBudgetMax: true, buyerLocation: true, buyerPurpose: true,
      },
      where: { OR: [{ buyerBudgetMin: { not: null } }, { buyerPurpose: { not: null } }, { status: "HOT_LEAD" }] },
      orderBy: { leadScore: "desc" },
      take: 100,
    })
  } catch {}

  return <AdvisorClient contacts={JSON.parse(JSON.stringify(contacts))} />
}
