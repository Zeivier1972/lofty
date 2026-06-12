export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getLoanOfficer } from "@/lib/lender-auth"
import LenderDashboardClient from "./dashboard-client"

export default async function LenderDashboardPage() {
  const partner = await getLoanOfficer()
  if (!partner) redirect("/lender/login")

  const shares = await prisma.leadShare.findMany({
    where: { loanOfficerId: partner.id, status: { in: ["PENDING", "PAID"] } },
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
    const paid = s.status === "PAID"
    return {
      id: s.id,
      status: s.status,
      loStatus: s.loStatus,
      price: s.price,
      sharedAt: s.createdAt.toISOString(),
      // Locked previews only reveal first name + last initial and general interest
      firstName: s.contact.firstName,
      lastInitial: s.contact.lastName ? `${s.contact.lastName.charAt(0)}.` : "",
      lastName: paid ? s.contact.lastName : null,
      phone: paid ? s.contact.phone : null,
      email: paid ? s.contact.email : null,
      budgetMax: s.contact.buyerBudgetMax,
      location: s.contact.buyerLocation,
      propertyType: s.contact.buyerPropertyType,
      source: paid ? s.contact.source : null,
    }
  })

  return (
    <LenderDashboardClient
      partner={{ name: partner.name, company: partner.company }}
      leads={leads}
    />
  )
}
