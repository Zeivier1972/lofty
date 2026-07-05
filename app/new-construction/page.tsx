import { searchIdxListings, buildDisplayAddress, fetchPrimaryPhotos } from "@/lib/bridge"
import { prisma } from "@/lib/prisma"
import PreConstructionListingsClient from "./pre-construction-listings-client"

export const metadata = {
  title: "New Construction Miami | Pre-Construction Homes & Condos — Catherine Gomez Realtor",
  description:
    "Browse new construction homes and condos in Miami, Doral, Coral Gables, Aventura and South Florida. New builds 2025–2027, live MLS listings updated daily. Contact Catherine Gomez Realtor.",
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

  return (
    <PreConstructionListingsClient
      initialResults={initialResults}
      calendlyUrl={config?.calendlyUrl || null}
      agentName={config?.realtorName || "Catherine Gómez"}
      agentPhone={config?.realtorPhone || null}
    />
  )
}
