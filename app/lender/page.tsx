export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getLoanOfficer } from "@/lib/lender-auth"
import LenderDashboardClient from "./dashboard-client"

export default async function LenderDashboardPage() {
  const partner = await getLoanOfficer()
  if (!partner) redirect("/lender/login")

  const isSubscribed = partner.subscriptionStatus === "active"

  const shares = await prisma.leadShare.findMany({
    where: {
      loanOfficerId: partner.id,
      status: { in: ["ACTIVE", "PENDING", "PAID"] },
    },
    orderBy: { createdAt: "desc" },
    include: {
      contact: {
        select: {
          firstName: true, lastName: true, phone: true, email: true,
          buyerBudgetMax: true, buyerLocation: true, buyerPropertyType: true,
          source: true, createdAt: true,
        },
      },
    },
  })

  const leads = shares.map(s => {
    // Legacy per-lead paid shares are always accessible; new ACTIVE shares need subscription
    const unlocked = s.status === "PAID" || isSubscribed
    return {
      id: s.id,
      status: s.status,
      loStatus: s.loStatus,
      sharedAt: s.createdAt.toISOString(),
      firstName: s.contact.firstName,
      lastInitial: s.contact.lastName ? `${s.contact.lastName.charAt(0)}.` : "",
      lastName: unlocked ? s.contact.lastName : null,
      phone: unlocked ? s.contact.phone : null,
      email: unlocked ? s.contact.email : null,
      budgetMax: s.contact.buyerBudgetMax,
      location: s.contact.buyerLocation,
      propertyType: s.contact.buyerPropertyType,
      source: unlocked ? s.contact.source : null,
    }
  })

  return (
    <LenderDashboardClient
      partner={{
        name: partner.name,
        company: partner.company,
        subscriptionStatus: partner.subscriptionStatus,
        subscriptionEndDate: partner.subscriptionEndDate?.toISOString() || null,
        monthlyFee: partner.monthlyFee,
      }}
      leads={leads}
    />
  )
}
