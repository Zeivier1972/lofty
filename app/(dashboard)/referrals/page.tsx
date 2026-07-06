export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import ReferralsClient from "./referrals-client"

export default async function ReferralsPage() {
  let partners: any[] = []
  let referrals: any[] = []

  try {
    ;[partners, referrals] = await Promise.all([
      prisma.referralPartner.findMany({
        orderBy: { createdAt: "asc" },
        include: { referrals: { select: { id: true, status: true } } },
      }),
      prisma.leadReferral.findMany({
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, phone: true, email: true, buyerLocation: true, buyerBudgetMax: true } },
          partner: { select: { id: true, name: true, brokerage: true } },
        },
        orderBy: { sentAt: "desc" },
        take: 200,
      }),
    ])
  } catch (e) {
    console.error("Referrals page error:", e)
  }

  return (
    <ReferralsClient
      partners={JSON.parse(JSON.stringify(partners))}
      referrals={JSON.parse(JSON.stringify(referrals))}
    />
  )
}
