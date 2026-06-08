export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const now = new Date()

  const stages = await prisma.pipelineStage.findMany({
    where: { pipeline: { isDefault: true } },
    include: {
      leads: {
        select: { id: true, enteredAt: true, createdAt: true, value: true, updatedAt: true },
      },
    },
    orderBy: { order: "asc" },
  })

  const stageMetrics = stages.map(stage => {
    const leads = stage.leads
    const totalLeads = leads.length

    // Calculate avg days in stage for each lead
    const daysInStage = leads.map(l => {
      const entered = l.enteredAt || l.createdAt
      return (now.getTime() - entered.getTime()) / (24 * 3600000)
    })

    const avgDays = daysInStage.length > 0
      ? daysInStage.reduce((a, b) => a + b, 0) / daysInStage.length
      : 0

    // Stale leads: in stage > 14 days
    const staleLeads = daysInStage.filter(d => d > 14).length

    const totalValue = leads.reduce((sum, l) => sum + (l.value || 0), 0)

    return {
      stageId: stage.id,
      stageName: stage.name,
      stageColor: stage.color,
      order: stage.order,
      totalLeads,
      avgDaysInStage: Math.round(avgDays * 10) / 10,
      staleLeads,
      totalValue,
    }
  })

  // Overall conversion funnel: leads count per stage as percentage of first stage
  const firstStageCount = stageMetrics[0]?.totalLeads || 1
  const funnel = stageMetrics.map(s => ({
    ...s,
    conversionRate: firstStageCount > 0 ? Math.round((s.totalLeads / firstStageCount) * 100) : 0,
  }))

  // Activities in last 30 days grouped by type
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600000)
  const activityBreakdown = await prisma.activity.groupBy({
    by: ["type"],
    where: { createdAt: { gte: thirtyDaysAgo } },
    _count: true,
    orderBy: { _count: { type: "desc" } },
    take: 8,
  })

  return NextResponse.json({ funnel, activityBreakdown })
}
