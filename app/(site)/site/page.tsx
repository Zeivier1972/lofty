export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { fetchPrimaryPhotos } from "@/lib/bridge"
import nextDynamic from "next/dynamic"
import type { Metadata } from "next"

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"

export const metadata: Metadata = {
  title: "Catherine Gomez Realtor — Miami Real Estate | New Construction & Pre-Construction Homes",
  description: "Find your dream home in Miami with Catherine Gomez, your trusted Florida Realtor. New construction, pre-construction condos, luxury homes. Bilingual — Atención en Español. Licensed in FL.",
  alternates: { canonical: BASE },
  openGraph: {
    title: "Catherine Gomez Realtor — Miami Real Estate",
    description: "Find your dream home in Miami. New construction, pre-construction condos, luxury homes. Bilingual Realtor — Atención en Español.",
    url: BASE,
    type: "website",
    siteName: "Catherine Gomez Realtor",
    images: [{ url: `${BASE}/og-home.jpg`, width: 1200, height: 630, alt: "Catherine Gomez Realtor — Miami Real Estate" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Catherine Gomez Realtor — Miami Real Estate",
    description: "New construction, pre-construction condos, luxury homes in Miami. Bilingual Realtor.",
  },
}

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

  // LocalBusiness + RealEstateAgent JSON-LD for AI Overview and local SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": ["RealEstateAgent", "LocalBusiness"],
    name: "Catherine Gomez Realtor",
    description: "Licensed Florida Realtor specializing in new construction, pre-construction condos, and luxury homes in Miami and South Florida. Bilingual — English & Spanish.",
    url: BASE,
    telephone: "+1-305-000-0000",
    areaServed: [
      "Miami", "Miami Beach", "Coral Gables", "Doral", "Aventura",
      "Sunny Isles Beach", "Brickell", "Edgewater", "Wynwood", "Hialeah",
    ],
    knowsLanguage: ["en", "es"],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Miami Real Estate Services",
      itemListElement: [
        { "@type": "Offer", itemOffered: { "@type": "Service", name: "New Construction Buyer Representation" } },
        { "@type": "Offer", itemOffered: { "@type": "Service", name: "Pre-Construction Condo Sales" } },
        { "@type": "Offer", itemOffered: { "@type": "Service", name: "Luxury Home Sales" } },
        { "@type": "Offer", itemOffered: { "@type": "Service", name: "Bilingual Real Estate Services" } },
      ],
    },
    sameAs: [],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomeClient
        config={config}
        websiteConfig={websiteConfig}
        featuredProperties={featuredProperties}
        stats={stats}
      />
    </>
  )
}
