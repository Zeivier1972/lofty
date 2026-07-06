import { fetchListingByKey, fetchListingMedia } from "@/lib/bridge"
import { prisma } from "@/lib/prisma"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import PropertyDetailClient from "./property-detail-client"

interface Props {
  params: { listingKey: string }
}

function fmtPrice(p: number) {
  if (p >= 1_000_000) return "$" + (p / 1_000_000).toFixed(p % 1_000_000 === 0 ? 0 : 1) + "M"
  return "$" + p.toLocaleString()
}

// Strip phone numbers and emails from MLS remarks before displaying publicly
function sanitizeRemarks(text: string): string {
  return text
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/gi, "")
    .replace(/\b(\+?1[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}\b/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const listing = await fetchListingByKey(params.listingKey).catch(() => null)
  if (!listing) return { title: "Property Not Found — Catherine Gomez Realtor" }

  const city = (listing.City as string | null) || "South Florida"
  const beds = listing.BedroomsTotal as number | null
  const baths = listing.BathroomsTotalDecimal as number | null
  const price = listing.ListPrice as number | null
  const subType = (listing.PropertySubType as string | null) || "New Construction"
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"
  const url = `${base}/new-construction/${params.listingKey}`

  const specsLabel = [
    beds ? `${beds} Bed` : "",
    baths ? `${Math.floor(baths)} Bath` : "",
  ].filter(Boolean).join(", ")

  const title = [
    specsLabel || subType,
    `New Construction in ${city}`,
    price ? fmtPrice(price) : "",
    "| Catherine Gomez Realtor",
  ].filter(Boolean).join(" — ")

  const rawRemarks = (listing.PublicRemarks as string | null) || ""
  const description = rawRemarks
    ? sanitizeRemarks(rawRemarks).slice(0, 155) + (rawRemarks.length > 155 ? "…" : "")
    : `${specsLabel ? specsLabel + " " : ""}${subType} in ${city}${price ? ` priced at ${fmtPrice(price)}` : ""}. New construction property sourced directly from the MLS. Contact Catherine Gomez Realtor.`

  const photos = await fetchListingMedia(params.listingKey).catch(() => [] as string[])
  const ogImage = photos[0] || null

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      siteName: "Catherine Gomez Realtor",
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630, alt: title }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : [],
    },
  }
}

export default async function PropertyDetailPage({ params }: Props) {
  const [listing, photos, config] = await Promise.all([
    fetchListingByKey(params.listingKey).catch(() => null),
    fetchListingMedia(params.listingKey).catch(() => [] as string[]),
    prisma.aIConfig.findFirst({
      select: { calendlyUrl: true, realtorName: true, realtorPhone: true },
    }).catch(() => null),
  ])

  if (!listing) notFound()

  const mlsId = (listing.ListingId ?? listing.ListingKey ?? "") as string
  const city = (listing.City as string | null) ?? null
  const state = (listing.StateOrProvince as string | null) ?? null
  const subType = (listing.PropertySubType as string | null) ?? null
  const price = (listing.ListPrice as number | null) ?? null
  const beds = (listing.BedroomsTotal as number | null) ?? null
  const baths = (listing.BathroomsTotalDecimal as number | null) ?? null
  const sqft = (listing.LivingArea as number | null) ?? null
  const yearBuilt = (listing.YearBuilt as number | null) ?? null
  const garage = (listing.GarageSpaces as number | null) ?? null
  const pool = (listing.PoolPrivateYN as boolean | null) ?? null
  const hoa = (listing.AssociationFee as number | null) ?? null
  const lotAcres = (listing.LotSizeAcres as number | null) ?? null
  const rawFeatures = listing.InteriorFeatures
  const features = Array.isArray(rawFeatures) ? rawFeatures as string[] : []
  const description = sanitizeRemarks((listing.PublicRemarks as string | null) || "")

  // JSON-LD structured data — helps Google AI Overview understand the property
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"
  const typeLabel = subType ? subType.replace(/([A-Z])/g, " $1").trim() : "New Construction"

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: `${typeLabel} in ${city || "South Florida"}`,
    description: description.slice(0, 300) || undefined,
    url: `${base}/new-construction/${params.listingKey}`,
    image: photos.slice(0, 6),
    offers: price ? {
      "@type": "Offer",
      price,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    } : undefined,
    address: {
      "@type": "PostalAddress",
      addressLocality: city || "",
      addressRegion: state || "FL",
      addressCountry: "US",
    },
    numberOfRooms: beds || undefined,
    numberOfBedrooms: beds || undefined,
    numberOfBathroomsTotal: baths ? Math.floor(baths) : undefined,
    floorSize: sqft ? {
      "@type": "QuantitativeValue",
      value: sqft,
      unitCode: "SQF",
    } : undefined,
    yearBuilt: yearBuilt || undefined,
  }

  const property = {
    listingKey: listing.ListingKey as string,
    listingId: mlsId,
    city,
    state,
    price,
    beds,
    baths,
    sqft,
    yearBuilt,
    subType,
    garage,
    pool,
    hoa,
    lotAcres,
    features,
    description,
    photos,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PropertyDetailClient
        property={property}
        calendlyUrl={config?.calendlyUrl || null}
        agentName={config?.realtorName || "Catherine Gomez"}
      />
    </>
  )
}
