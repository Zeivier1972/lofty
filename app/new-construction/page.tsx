import { searchIdxListings, buildDisplayAddress, fetchPrimaryPhotos } from "@/lib/bridge"
import { prisma } from "@/lib/prisma"
import type { Metadata } from "next"
import PreConstructionListingsClient from "./pre-construction-listings-client"

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"
const PAGE_URL = `${BASE}/new-construction`
const TITLE = "New Construction Miami | Pre-Construction Homes & Condos — Catherine Gomez Realtor"
const DESCRIPTION =
  "Browse new construction homes and condos in Miami, Doral, Coral Gables, Aventura and South Florida. New builds 2025–2027, live MLS listings updated daily. Licensed Realtor — bilingual service."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: PAGE_URL,
    type: "website",
    siteName: "Catherine Gomez Realtor",
    images: [{ url: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80", width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80"],
  },
}

export default async function PreConstructionPage() {
  const [config, listings] = await Promise.all([
    prisma.aIConfig.findFirst({ select: { calendlyUrl: true, realtorPhone: true, realtorName: true } }).catch(() => null),
    searchIdxListings({ minYear: 2025, limit: 24, sort: "price_asc" }).catch(() => []),
  ])

  const keys = listings.map((l: any) => l.ListingKey).filter(Boolean)
  const photos: Record<string, string> = await fetchPrimaryPhotos(keys).catch(() => ({} as Record<string, string>))

  const initialResults = listings.map((l: any) => ({
    listingKey: l.ListingKey as string,
    listingId: (l.ListingId ?? l.ListingKey ?? "") as string, // real MLS# (e.g. A11234567)
    address: buildDisplayAddress(l),
    city: (l.City ?? null) as string | null,
    state: (l.StateOrProvince ?? null) as string | null,
    zip: (l.PostalCode ?? null) as string | null,
    price: (l.ListPrice ?? null) as number | null,
    beds: (l.BedroomsTotal ?? null) as number | null,
    baths: (l.BathroomsTotalDecimal ?? null) as number | null,
    sqft: (l.LivingArea ?? null) as number | null,
    yearBuilt: (l.YearBuilt ?? null) as number | null,
    subType: (l.PropertySubType ?? null) as string | null,
    description: l.PublicRemarks ? String(l.PublicRemarks).slice(0, 300) : null,
    photo: photos[String(l.ListingKey)] || null,
  }))

  // JSON-LD — ItemList for Google and AI Overview
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "New Construction Homes & Condos in Miami",
    description: DESCRIPTION,
    url: PAGE_URL,
    numberOfItems: initialResults.length,
    itemListElement: initialResults.slice(0, 10).map((l, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${BASE}/new-construction/${l.listingKey}`,
      name: [
        l.subType ? l.subType.replace(/([A-Z])/g, " $1").trim() : "New Construction",
        l.city ? `in ${l.city}` : "",
        l.price ? `$${l.price >= 1_000_000 ? (l.price / 1_000_000).toFixed(1) + "M" : l.price.toLocaleString()}` : "",
      ].filter(Boolean).join(" "),
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PreConstructionListingsClient
        initialResults={initialResults}
        calendlyUrl={config?.calendlyUrl || null}
        agentName={config?.realtorName || "Catherine Gómez"}
        agentPhone={config?.realtorPhone || null}
      />
    </>
  )
}
