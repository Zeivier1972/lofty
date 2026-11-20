export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { sanitizeForGoogle } from "@/lib/google-business"

/**
 * RSS feed of the CRM's recent Facebook image posts, rewritten for a Google
 * Business Profile post (no phone numbers or hashtags, ≤1,500 characters).
 *
 * Why: Google turned down the Business Profile API request, so the CRM cannot
 * post to the profile itself. Zapier has its own approved access, so a Zap
 * "RSS by Zapier → New Item in Feed" → "Google Business Profile → Create Post"
 * reads this feed and publishes each new item. Public on purpose: everything
 * in it is already published on Facebook.
 *
 * GET /api/social/google-feed
 */

const BASE = "https://www.catherinegomezrealtor.com"

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const isVideo = (url: string) => /\.(mp4|mov|m4v)(\?|$)/i.test(url) || /\/video\//.test(url)

const BLOG_LINK = /https?:\/\/(?:www\.)?catherinegomezrealtor\.com\/site\/blog\/([A-Za-z0-9_-]+)/g

/**
 * Older posts carry blog links whose slug the model cut short (404). Point each
 * one at the real article: exact slug if it exists, else the newest published
 * slug starting with the same words; drop the link line if there is none.
 */
async function repairBlogLinks(text: string): Promise<string> {
  let out = text
  for (const m of Array.from(text.matchAll(BLOG_LINK))) {
    const slug = m[1]
    const exact = await prisma.blogPost.findFirst({ where: { slug, published: true }, select: { slug: true } })
    if (exact) continue
    const prefix = slug.replace(/-\d*$/, "")
    const match = prefix.length > 10
      ? await prisma.blogPost.findFirst({ where: { slug: { startsWith: `${prefix}-` }, published: true }, orderBy: { publishedAt: "desc" }, select: { slug: true } })
      : null
    out = match
      ? out.split(m[0]).join(`${BASE}/site/blog/${match.slug}`)
      : out.split("\n").filter(l => !l.includes(m[0])).join("\n")
  }
  return out
}

export async function GET() {
  const posts = await prisma.socialPost.findMany({
    where: { platform: "FACEBOOK", status: "PUBLISHED", mediaUrl: { not: null } },
    orderBy: { publishedAt: "desc" },
    take: 25,
    select: { id: true, content: true, mediaUrl: true, publishedAt: true, createdAt: true },
  })

  // One post a day is plenty for a Business Profile: keep the latest image post per day.
  const seen = new Set<string>()
  const items = posts
    .filter(p => p.mediaUrl && !isVideo(p.mediaUrl))
    .filter(p => {
      const day = (p.publishedAt || p.createdAt).toISOString().slice(0, 10)
      if (seen.has(day)) return false
      seen.add(day)
      return true
    })
    .slice(0, 10)

  const repaired = await Promise.all(items.map(async p => ({ ...p, content: await repairBlogLinks(p.content) })))
  const rendered = repaired
    .map(p => {
      const text = sanitizeForGoogle(p.content)
      const title = (text.split("\n").find(l => l.trim()) || "Catherine Gomez Realtor").slice(0, 90)
      const date = (p.publishedAt || p.createdAt).toUTCString()
      return `    <item>
      <title>${esc(title)}</title>
      <link>${BASE}/?ref=gbp-${p.id}</link>
      <guid isPermaLink="false">${p.id}</guid>
      <pubDate>${date}</pubDate>
      <description>${esc(text)}</description>
      <enclosure url="${esc(p.mediaUrl!)}" type="image/jpeg" length="0" />
    </item>`
    })

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Catherine Gomez Realtor — publicaciones para Google</title>
    <link>${BASE}</link>
    <description>Publicaciones del CRM para el perfil de Google Business</description>
    <language>es</language>
${rendered.join("\n")}
  </channel>
</rss>`

  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=300" } })
}
