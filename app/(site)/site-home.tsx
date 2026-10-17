import { prisma } from "@/lib/prisma"
import { fetchPrimaryPhotos } from "@/lib/bridge"
import nextDynamic from "next/dynamic"
import type { Metadata } from "next"

// Pinned to the canonical www host rather than read from NEXT_PUBLIC_APP_URL.
// This string is the homepage's canonical tag, its Open Graph url and the `@id`
// that every other page's JSON-LD points at, so it has to be the one public
// address and the same one every time — an env var that happens to hold the
// Railway domain in some environment would quietly publish the wrong canonical
// and split the site's identity in two. The other public pages hardcode the
// same host.
const BASE = "https://www.catherinegomezrealtor.com"

// Shared SEO metadata for the public real-estate homepage. Re-exported by both
// the bare domain (app/page.tsx) and /site so they stay identical.
export const siteHomeMetadata: Metadata = {
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
const HomeClient = nextDynamic(() => import("./home-client"), { ssr: false })

// The public real-estate homepage. Rendered at both the bare domain "/" and "/site".
export default async function SiteHome() {
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

  // LocalBusiness + RealEstateAgent JSON-LD for AI Overview and local SEO.
  //
  // Everything here is read from WebsiteConfig rather than written inline: the
  // phone number was hard-coded as "+1-305-000-0000", a placeholder, which is
  // precisely the field a voice assistant reads aloud when someone asks how to
  // reach Catherine. Sourcing it from the record she already edits in Settings
  // means it cannot drift again, and the social links fill `sameAs`, which is
  // how Google ties the site to the Google Business Profile.
  const toE164 = (raw: string) => {
    const d = raw.replace(/\D/g, "")
    if (!d) return null
    if (raw.trim().startsWith("+")) return `+${d}`
    return d.length === 10 ? `+1${d}` : `+${d}`
  }
  const telephone = toE164(websiteConfig?.agentPhone || "305-283-0872")
  const email = websiteConfig?.agentEmail || "info@catherinegomezrealtor.com"
  const sameAs = [
    websiteConfig?.facebook,
    websiteConfig?.instagram,
    websiteConfig?.linkedin,
    websiteConfig?.youtube,
  ].filter((u): u is string => !!u && /^https?:\/\//.test(u))

  const agent = {
    "@type": ["RealEstateAgent", "LocalBusiness"],
    "@id": `${BASE}#agent`,
    name: "Catherine Gomez Realtor",
    description: "Licensed Florida Realtor specializing in new construction, pre-construction condos, and luxury homes in Miami, Orlando and South Florida. Bilingual — English & Spanish.",
    url: BASE,
    ...(telephone ? { telephone } : {}),
    email,
    ...(websiteConfig?.agentPhotoUrl ? { image: websiteConfig.agentPhotoUrl } : {}),
    ...(websiteConfig?.logoUrl ? { logo: websiteConfig.logoUrl } : {}),
    ...(websiteConfig?.agentBrokerage ? { parentOrganization: { "@type": "Organization", name: websiteConfig.agentBrokerage } } : {}),
    areaServed: [
      "Miami", "Miami Beach", "Coral Gables", "Doral", "Aventura",
      "Sunny Isles Beach", "Brickell", "Edgewater", "Wynwood", "Hialeah", "Orlando",
    ].map(name => ({ "@type": "City", name, addressRegion: "FL" })),
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
    ...(sameAs.length ? { sameAs } : {}),
  }

  // WebSite + SearchAction: the markup that declares this site searchable.
  // It powers Google's sitelinks searchbox and lets an assistant hand a spoken
  // query straight to /homes, which now parses one free-text `q` into filters.
  const website = {
    "@type": "WebSite",
    "@id": `${BASE}#website`,
    url: BASE,
    name: "Catherine Gomez Realtor",
    inLanguage: ["es", "en"],
    publisher: { "@id": `${BASE}#agent` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BASE}/homes?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  }

  const jsonLd = { "@context": "https://schema.org", "@graph": [agent, website] }

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
