export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let config = await prisma.instagramBotConfig.findFirst()
  if (!config) {
    config = await prisma.instagramBotConfig.create({ data: {} })
  }

  const stats = await Promise.all([
    prisma.instagramConversation.count(),
    prisma.instagramConversation.count({ where: { state: "COMPLETE" } }),
    prisma.instagramConversation.count({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600000) } },
    }),
    prisma.instagramConversation.findMany({
      where: { state: "COMPLETE" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ])

  return NextResponse.json({
    config,
    stats: {
      totalConversations: stats[0],
      captured: stats[1],
      thisWeek: stats[2],
      recentLeads: stats[3],
    },
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const data: Record<string, any> = {}
  for (const key of [
    "isEnabled", "triggerKeywords", "msgGreeting", "msgAskIntent",
    "msgAskName", "msgAskEmail", "msgAskPhone", "msgThankYou", "websiteUrl",
    "greetingButtons", "intentButtonA", "intentButtonB", "intentButtonC",
  ]) {
    if (body[key] !== undefined) data[key] = body[key]
  }
  const existing = await prisma.instagramBotConfig.findFirst()

  const config = existing
    ? await prisma.instagramBotConfig.update({ where: { id: existing.id }, data })
    : await prisma.instagramBotConfig.create({ data })

  return NextResponse.json(config)
}
