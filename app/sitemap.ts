import type { MetadataRoute } from "next"
import { SOFLA_CITIES } from "@/lib/sofla-cities"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/homes`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/book`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ]

  const cityPages: MetadataRoute.Sitemap = SOFLA_CITIES.map(c => ({
    url: `${base}/comprar/${c.slug}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.8,
  }))

  return [...staticPages, ...cityPages]
}
