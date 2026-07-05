import type { MetadataRoute } from "next"
import { SOFLA_CITIES } from "@/lib/sofla-cities"
import { searchIdxListings } from "@/lib/bridge"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/homes`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/new-construction`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/book`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ]

  const cityPages: MetadataRoute.Sitemap = SOFLA_CITIES.map(c => ({
    url: `${base}/comprar/${c.slug}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }))

  // Add individual new-construction listing pages
  let listingPages: MetadataRoute.Sitemap = []
  try {
    const listings = await searchIdxListings({ minYear: 2025, limit: 100, sort: "price_asc" })
    listingPages = listings
      .filter((l: any) => l.ListingKey)
      .map((l: any) => ({
        url: `${base}/new-construction/${l.ListingKey}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.75,
      }))
  } catch {
    // Non-fatal — sitemap generates without MLS pages if Bridge is unavailable
  }

  return [...staticPages, ...cityPages, ...listingPages]
}
