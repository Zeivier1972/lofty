export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    let config = await prisma.facebookBotConfig.findFirst()
    if (!config) config = await prisma.facebookBotConfig.create({ data: {} })

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const [stateGroups, thisWeek] = await Promise.all([
      prisma.facebookBotConversation.groupBy({ by: ["state"], _count: { id: true } }),
      prisma.facebookBotConversation.count({ where: { state: "COMPLETE", updatedAt: { gte: weekAgo } } }),
    ])

    const totalConversations = stateGroups.reduce((s, g) => s + g._count.id, 0)
    const captured = stateGroups.find(g => g.state === "COMPLETE")?._count.id || 0

    return NextResponse.json({ config, stats: { totalConversations, captured, thisWeek } })
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const existing = await prisma.facebookBotConfig.findFirst()

    const config = existing
      ? await prisma.facebookBotConfig.update({ where: { id: existing.id }, data: body })
      : await prisma.facebookBotConfig.create({ data: body })

    return NextResponse.json(config)
  } catch (e) {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}
