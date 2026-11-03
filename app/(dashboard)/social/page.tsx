export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import SocialClient from "./social-client"

export default async function SocialPage() {
  let accounts: any[] = []
  let posts: any[] = []
  let stats: any[] = []

  try {
    ;[accounts, posts] = await Promise.all([
      prisma.socialAccount.findMany({ orderBy: { platform: "asc" } }),
      prisma.socialPost.findMany({
        include: { account: { select: { accountName: true } } },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ])
    // Analytics across every published post, not just the 30 listed below.
    const g = await prisma.socialPost.groupBy({
      by: ["platform"],
      where: { status: "PUBLISHED" },
      _count: { _all: true },
      _sum: { reach: true, likes: true, comments: true, shares: true },
    })
    stats = g.map(r => ({
      platform: r.platform,
      posts: r._count._all,
      reach: r._sum.reach || 0,
      engagement: (r._sum.likes || 0) + (r._sum.comments || 0) + (r._sum.shares || 0),
    }))
  } catch (e) {
    console.error("Social page error:", e)
  }

  return (
    <SocialClient
      accounts={JSON.parse(JSON.stringify(accounts))}
      posts={JSON.parse(JSON.stringify(posts))}
      stats={stats}
    />
  )
}
