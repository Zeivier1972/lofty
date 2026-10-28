import type { MetadataRoute } from "next"
import { SOFLA_CITIES } from "@/lib/sofla-cities"
import { searchIdxListings } from "@/lib/bridge"
import { prisma } from "@/lib/prisma"

/**
 * Regenerated hourly rather than baked at build time.
 *
 * It used to be fully static, which was fine while every URL in here was known
 * at build: the city pages come from a constant and the MLS pages only went
 * stale. Webinars are different — Catherine adds one and it has to be
 * discoverable this week, not after the next deploy. An hour is well inside
 * how often Google refetches a sitemap, and it keeps the MLS call cached rather
 * than running it on every request.
 */
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/homes`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/new-construction`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/guias/inversionista-costa-rica`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/inversion/millenia-park`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/inversion/gz-tower`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/house-of-wellness`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/parkside`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/proyectos`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/book`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/data-deletion`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ]

  const cityPages: MetadataRoute.Sitemap = SOFLA_CITIES.map(c => ({
    url: `${base}/comprar/${c.slug}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }))

  // Webinars: the registration page while it is upcoming, and the replay page
  // once there is a recording. The replay is the one that matters for search —
  // it keeps bringing registrations months after the session, which is the
  // whole reason it is a public page and not gated behind a form.
  let webinarPages: MetadataRoute.Sitemap = []
  try {
    const webinars = await prisma.webinar.findMany({
      where: { status: { not: "CANCELLED" } },
      select: { slug: true, startsAt: true, replayUrl: true, updatedAt: true },
      orderBy: { startsAt: "desc" },
      take: 200,
    })
    for (const w of webinars) {
      const upcoming = w.startsAt.getTime() > now.getTime()
      webinarPages.push({
        url: `${base}/webinar/${w.slug}`,
        lastModified: w.updatedAt,
        changeFrequency: upcoming ? ("daily" as const) : ("monthly" as const),
        priority: upcoming ? 0.9 : 0.5,
      })
      if (w.replayUrl) {
        webinarPages.push({
          url: `${base}/webinar/${w.slug}/replay`,
          lastModified: w.updatedAt,
          changeFrequency: "monthly" as const,
          priority: 0.7,
        })
      }
    }
  } catch {
    // Non-fatal — the sitemap still generates if the DB is unreachable.
  }

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

  return [...staticPages, ...webinarPages, ...cityPages, ...listingPages]
}
