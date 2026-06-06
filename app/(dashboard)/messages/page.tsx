export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import MessagesClient from "./messages-client"

export default async function MessagesPage() {
  let templates: any[] = []
  let recentEmails: any[] = []
  let smsCampaigns: any[] = []

  try {
    const session = await auth()
    const userId = session?.user?.id

    ;[templates, recentEmails, smsCampaigns] = await Promise.all([
      prisma.emailTemplate.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.email.findMany({
        where: { ...(userId && { userId }) },
        include: { contact: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.marketingCampaign.findMany({ orderBy: { createdAt: "desc" } }),
    ])
  } catch (e) {
    console.error("Messages page error:", e)
  }

  return (
    <MessagesClient
      templates={JSON.parse(JSON.stringify(templates))}
      recentEmails={JSON.parse(JSON.stringify(recentEmails))}
      campaigns={JSON.parse(JSON.stringify(smsCampaigns))}
    />
  )
}
