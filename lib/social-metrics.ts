import { prisma } from "@/lib/prisma"

/**
 * Pull reach / likes / comments / shares for recently published Facebook and
 * Instagram posts from the Graph API. The Analytics tab reads these columns,
 * which nothing filled before — so it always showed 0 reach and 0 engagement.
 *
 * Runs from the hourly autopilot check. Every call is best-effort: a post that
 * Meta won't report on (deleted, old video object, missing permission) is
 * skipped and the rest still update.
 */

const G = "https://graph.facebook.com/v19.0"

async function gj(url: string): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  const data = await res.json().catch(() => ({}))
  if (data?.error) throw new Error(data.error.message)
  return data
}

async function facebookMetrics(id: string, token: string) {
  const out: { reach?: number; likes?: number; comments?: number; shares?: number } = {}
  if (id.includes("_")) {
    const d = await gj(`${G}/${id}?fields=reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),shares&access_token=${token}`)
    out.likes = d.reactions?.summary?.total_count ?? 0
    out.comments = d.comments?.summary?.total_count ?? 0
    out.shares = d.shares?.count ?? 0
    try {
      const ins = await gj(`${G}/${id}/insights?metric=post_impressions_unique&access_token=${token}`)
      const v = ins.data?.[0]?.values?.[0]?.value
      if (typeof v === "number") out.reach = v
    } catch { /* insights need read_insights; counts still saved */ }
  } else {
    // Video object id (page /videos returns the video, not the feed post).
    const d = await gj(`${G}/${id}?fields=likes.summary(true).limit(0),comments.summary(true).limit(0)&access_token=${token}`)
    out.likes = d.likes?.summary?.total_count ?? 0
    out.comments = d.comments?.summary?.total_count ?? 0
    try {
      const ins = await gj(`${G}/${id}/video_insights?metric=total_video_impressions_unique&access_token=${token}`)
      const v = ins.data?.[0]?.values?.[0]?.value
      if (typeof v === "number") out.reach = v
    } catch { /* fine */ }
  }
  return out
}

async function instagramMetrics(id: string, token: string) {
  const out: { reach?: number; likes?: number; comments?: number; shares?: number } = {}
  const d = await gj(`${G}/${id}?fields=like_count,comments_count&access_token=${token}`)
  out.likes = d.like_count ?? 0
  out.comments = d.comments_count ?? 0
  for (const metric of ["reach", "shares"]) {
    try {
      const ins = await gj(`${G}/${id}/insights?metric=${metric}&access_token=${token}`)
      const v = ins.data?.[0]?.values?.[0]?.value ?? ins.data?.[0]?.total_value?.value
      if (typeof v === "number") (out as any)[metric] = v
    } catch { /* metric not available for this media type */ }
  }
  return out
}

export async function syncSocialMetrics(): Promise<{ checked: number; updated: number; errors: number }> {
  const posts = await prisma.socialPost.findMany({
    where: {
      status: "PUBLISHED",
      platform: { in: ["FACEBOOK", "INSTAGRAM"] },
      externalId: { not: null },
      OR: [
        { publishedAt: { gte: new Date(Date.now() - 45 * 86400000) } },
        { publishedAt: null, createdAt: { gte: new Date(Date.now() - 45 * 86400000) } },
      ],
    },
    // Least recently refreshed first, so every post gets its turn.
    orderBy: { updatedAt: "asc" },
    take: 60,
    include: { account: { select: { accessToken: true } } },
  })

  let updated = 0
  let errors = 0
  let firstError = ""
  for (const p of posts) {
    const token = p.account?.accessToken
    if (!token || !p.externalId || p.externalId.startsWith("cm_")) continue
    try {
      const m = p.platform === "FACEBOOK" ? await facebookMetrics(p.externalId, token) : await instagramMetrics(p.externalId, token)
      await prisma.socialPost.update({
        where: { id: p.id },
        data: { reach: m.reach ?? p.reach, likes: m.likes ?? p.likes, comments: m.comments ?? p.comments, shares: m.shares ?? p.shares },
      })
      updated++
    } catch (e: any) {
      errors++
      if (!firstError) firstError = `${p.platform} ${p.externalId}: ${e?.message || e}`
      // Touch updatedAt so a permanently failing post doesn't block the queue.
      await prisma.socialPost.update({ where: { id: p.id }, data: { updatedAt: new Date() } }).catch(() => null)
    }
  }
  console.log(`[social-metrics] checked ${posts.length}, updated ${updated}, errors ${errors}${firstError ? ` — first: ${firstError}` : ""}`)
  return { checked: posts.length, updated, errors }
}
