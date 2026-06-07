export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import HomeownerAgentClient from "./homeowner-agent-client"

export default async function HomeownerAgentPage() {
  await auth()

  let sellers: any[] = []
  let config: any = null

  try {
    sellers = await prisma.contact.findMany({
      where: {
        OR: [
          { sellerAddress: { not: null } },
          { sellerEstimatedValue: { not: null } },
          { status: "SELLER" },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    })
  } catch {
    sellers = []
  }

  try {
    config = await prisma.aIConfig.findFirst()
  } catch {
    config = null
  }

  return (
    <HomeownerAgentClient
      sellers={JSON.parse(JSON.stringify(sellers))}
      config={config ? JSON.parse(JSON.stringify(config)) : null}
    />
  )
}
