export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import SocialClient from "./social-client"

export default async function SocialPage() {
  const [accounts, posts] = await Promise.all([
    prisma.socialAccount.findMany({ orderBy: { platform: "asc" } }),
    prisma.socialPost.findMany({
      include: { account: { select: { accountName: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ])

  return (
    <SocialClient
      accounts={JSON.parse(JSON.stringify(accounts))}
      posts={JSON.parse(JSON.stringify(posts))}
    />
  )
}
