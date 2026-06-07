export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import HomeClient from "../home-client"

export default async function SitePage() {
  let config = null
  let websiteConfig = null
  let featuredProperties: any[] = []
  let stats = { _count: 0, _avg: { price: null as number | null } }

  try {
    ;[config, websiteConfig, featuredProperties, stats] = await Promise.all([
      prisma.aIConfig.findFirst(),
      prisma.websiteConfig.findFirst(),
      prisma.property.findMany({
        where: { status: "ACTIVE" },
        orderBy: { price: "desc" },
        take: 6,
      }),
      prisma.property.aggregate({ _count: true, _avg: { price: true } }),
    ])
  } catch (e) {
    console.error("Site page error:", e)
  }

  return (
    <HomeClient
      config={config}
      websiteConfig={websiteConfig}
      featuredProperties={featuredProperties}
      stats={stats}
    />
  )
}
