import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import ReportsClient from "./reports-client"
import { subMonths, startOfMonth, endOfMonth } from "date-fns"

export default async function ReportsPage() {
  const session = await auth()
  const userId = session?.user?.id

  const now = new Date()
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, 5 - i)
    return { start: startOfMonth(d), end: endOfMonth(d), label: d.toLocaleString("default", { month: "short" }) }
  })

  const [
    contactsByMonth,
    tasksByStatus,
    transactionsByStatus,
    topLeadSources,
    revenueByMonth,
    pipelineByStage,
  ] = await Promise.all([
    // New contacts per month
    Promise.all(months.map(async (m) => ({
      month: m.label,
      count: await prisma.contact.count({ where: { createdAt: { gte: m.start, lte: m.end } } }),
    }))),
    // Tasks by status
    prisma.task.groupBy({ by: ["status"], where: { assignedToId: userId }, _count: true }),
    // Transactions by status
    prisma.transaction.groupBy({ by: ["status"], where: { agentId: userId }, _count: true, _sum: { salePrice: true } }),
    // Top lead sources
    prisma.contact.groupBy({ by: ["source"], _count: true, orderBy: { _count: { source: "desc" } }, take: 6, where: { source: { not: null } } }),
    // Closed revenue per month
    Promise.all(months.map(async (m) => ({
      month: m.label,
      revenue: (await prisma.transaction.aggregate({
        where: { status: "CLOSED", agentId: userId, closeDate: { gte: m.start, lte: m.end } },
        _sum: { salePrice: true },
      }))._sum.salePrice || 0,
    }))),
    // Pipeline value by stage
    prisma.pipelineStage.findMany({
      where: { pipeline: { isDefault: true } },
      include: { leads: { select: { value: true } } },
      orderBy: { order: "asc" },
    }),
  ])

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
