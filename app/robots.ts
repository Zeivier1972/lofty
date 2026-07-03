import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/portal/", "/login", "/dashboard/"],
    },
    sitemap: `${base}/sitemap.xml`,
  }
}
