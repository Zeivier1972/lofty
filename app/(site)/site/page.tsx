export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import HomeClient from "../home-client"

export default async function SitePage() {
  const [config, featuredProperties, stats] = await Promise.all([
    prisma.aIConfig.findFirst(),
    prisma.property.findMany({
      where: { status: "ACTIVE" },
      orderBy: { price: "desc" },
      take: 6,
    }),
    prisma.property.aggregate({ _count: true, _avg: { price: true } }),
  ])

  return (
    <HomeClient
      config={config}
      featuredProperties={featuredProperties}
      stats={stats}
    />
  )
}
