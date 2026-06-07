export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import CampaignsClient from "./campaigns-client"

export default async function CampaignsPage() {
  const session = await auth()

  const [campaigns, tags, stats] = await Promise.all([
    prisma.marketingCampaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    Promise.all([
      prisma.contact.count({ where: { isArchived: false, doNotEmail: false, email: { not: null } } }),
      prisma.marketingCampaign.count({ where: { status: "SENT" } }),
      prisma.marketingCampaign.aggregate({ _sum: { recipients: true } }),
    ]),
  ])

  const [emailableContacts, sentCampaigns, totalSentAgg] = stats

  return (
    <CampaignsClient
      campaigns={JSON.parse(JSON.stringify(campaigns))}
      tags={JSON.parse(JSON.stringify(tags))}
      stats={{
        emailableContacts,
        sentCampaigns,
        totalSent: totalSentAgg._sum.recipients || 0,
      }}
    />
  )
}
