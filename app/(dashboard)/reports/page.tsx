export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import ReportsClient from "./reports-client"
import { subMonths, startOfMonth, endOfMonth } from "date-fns"

export default async function ReportsPage() {
  let contactsByMonth: any[] = []
  let tasksByStatus: any[] = []
  let transactionsByStatus: any[] = []
  let topLeadSources: any[] = []
  let revenueByMonth: any[] = []
  let pipelineByStage: any[] = []

  try {
    const session = await auth()
    const userId = session?.user?.id

    const now = new Date()
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, 5 - i)
      return { start: startOfMonth(d), end: endOfMonth(d), label: d.toLocaleString("default", { month: "short" }) }
    })

    ;[contactsByMonth, tasksByStatus, transactionsByStatus, topLeadSources, revenueByMonth, pipelineByStage] =
      await Promise.all([
        Promise.all(months.map(async (m) => ({
          month: m.label,
          count: await prisma.contact.count({ where: { createdAt: { gte: m.start, lte: m.end } } }),
        }))),
        prisma.task.groupBy({ by: ["status"], where: { ...(userId && { assignedToId: userId }) }, _count: true }),
        prisma.transaction.groupBy({ by: ["status"], where: { ...(userId && { agentId: userId }) }, _count: true, _sum: { salePrice: true } }),
        prisma.contact.groupBy({ by: ["source"], _count: true, orderBy: { _count: { source: "desc" } }, take: 6, where: { source: { not: null } } }),
        Promise.all(months.map(async (m) => ({
          month: m.label,
          revenue: (await prisma.transaction.aggregate({
            where: { status: "CLOSED", ...(userId && { agentId: userId }), closeDate: { gte: m.start, lte: m.end } },
            _sum: { salePrice: true },
          }))._sum.salePrice || 0,
        }))),
        prisma.pipelineStage.findMany({
          where: { pipeline: { isDefault: true } },
          include: { leads: { select: { value: true } } },
          orderBy: { order: "asc" },
        }),
      ])
  } catch (e) {
    console.error("Reports page error:", e)
  }

  return (
    <ReportsClient
      contactsByMonth={contactsByMonth}
      tasksByStatus={JSON.parse(JSON.stringify(tasksByStatus))}
      transactionsByStatus={JSON.parse(JSON.stringify(transactionsByStatus))}
      topLeadSources={JSON.parse(JSON.stringify(topLeadSources))}
      revenueByMonth={revenueByMonth}
      pipelineByStage={JSON.parse(JSON.stringify(pipelineByStage))}
    />
  )
}
