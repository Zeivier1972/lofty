export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { fetchPrimaryPhotos } from "@/lib/bridge"
import nextDynamic from "next/dynamic"

// Load with ssr:false so Framer Motion never runs server-side
const HomeClient = nextDynamic(() => import("../home-client"), { ssr: false })

export default async function SitePage() {
  let config = null
  let websiteConfig = null
  let featuredProperties: any[] = []
  let stats = { _count: 0, _avg: { price: null as number | null } }

  try {
    const rawProps = await prisma.property.findMany({
      where: { status: "ACTIVE" },
      orderBy: { price: "desc" },
      take: 6,
    })
    // Enrich missing photos
    const noPhoto = rawProps.filter(p => {
      try { const a = JSON.parse(p.images || "[]"); return !Array.isArray(a) || !a.some(Boolean) } catch { return true }
    })
    const photoMap: Record<string, string> = noPhoto.length > 0
      ? await fetchPrimaryPhotos(noPhoto.map(p => p.mlsId!).filter(Boolean)).catch(() => ({}))
      : {}
    featuredProperties = rawProps.map(p => {
      try {
        const a = JSON.parse(p.images || "[]")
        if (Array.isArray(a) && a.some(Boolean)) return p
      } catch {}
      return photoMap[p.mlsId!] ? { ...p, images: JSON.stringify([photoMap[p.mlsId!]]) } : p
    })

    ;[config, websiteConfig, stats] = await Promise.all([
      prisma.aIConfig.findFirst(),
      prisma.websiteConfig.findFirst(),
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
