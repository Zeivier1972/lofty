import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const platform = searchParams.get("platform")
  const status = searchParams.get("status")

  const posts = await prisma.socialPost.findMany({
    where: {
      ...(platform ? { platform } : {}),
      ...(status ? { status } : {}),
    },
    include: { account: { select: { id: true, platform: true, accountName: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return NextResponse.json(posts)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { platform, content, mediaUrl, postType, scheduledAt, accountId, aiGenerated, prompt } = await req.json()

  const post = await prisma.socialPost.create({
    data: {
      platform,
      content,
      mediaUrl,
      postType: postType || "POST",
      status: scheduledAt ? "SCHEDULED" : "DRAFT",
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      accountId,
      aiGenerated: aiGenerated || false,
      prompt,
    },
  })

  return NextResponse.json(post, { status: 201 })
}
