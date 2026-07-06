export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getPartnerSession } from "@/lib/partner-auth"
import PartnerClient from "./partner-client"

export default async function PartnerPage() {
  const session = await getPartnerSession()
  if (!session) redirect("/partner/login")

  const partner = await prisma.referralPartner.findUnique({
    where: { id: session.partnerId },
    select: { id: true, name: true, isActive: true },
  })
  if (!partner || !partner.isActive) redirect("/partner/login?error=Account+inactive")

  const [referrals, aiConfig] = await Promise.all([
    prisma.leadReferral.findMany({
      where: { partnerId: partner.id },
      include: {
        contact: {
          select: {
            id: true, firstName: true, lastName: true, phone: true, email: true,
            buyerLocation: true, buyerBudgetMin: true, buyerBudgetMax: true,
            buyerBedroomsMin: true, buyerPropertyType: true, buyerTimelineMonths: true,
          },
        },
        updates: { orderBy: { createdAt: "desc" }, take: 30 },
      },
      orderBy: { sentAt: "desc" },
    }),
    prisma.aIConfig.findFirst({ select: { realtorName: true, realtorPhone: true } }).catch(() => null),
  ])

  return (
    <PartnerClient
      partnerName={partner.name}
      agentName={aiConfig?.realtorName || "Catherine Gomez"}
      agentPhone={aiConfig?.realtorPhone || "305-283-0872"}
      referrals={JSON.parse(JSON.stringify(referrals))}
    />
  )
}
