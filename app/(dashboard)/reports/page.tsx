export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import ReportsClient from "./reports-client"
import { subMonths, startOfMonth, endOfMonth } from "date-fns"

type MessagingVolume = {
  smsMonthly: { month: string; count: number }[]
  emailMonthly: { month: string; count: number }[]
  totals: {
    smsLast30: number
    emailLast30: number
    smsLast7: number
    emailLast7: number
    smsCost: number
    emailCost: number
  }
} | null

export default async function ReportsPage() {
  let contactsByMonth: any[] = []
  let tasksByStatus: any[] = []
  let transactionsByStatus: any[] = []
  let topLeadSources: any[] = []
  let revenueByMonth: any[] = []
  let pipelineByStage: any[] = []
  let messagingVolume: MessagingVolume = null

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

  try {
    const now = new Date()
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, 5 - i)
      return { start: startOfMonth(d), end: endOfMonth(d), label: d.toLocaleString("default", { month: "short" }) }
    })
    const days30ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const days7ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [smsOut, emailAct, emailOut] = await Promise.all([
      prisma.sMSMessage.findMany({
        where: { direction: "OUTBOUND", createdAt: { gte: months[0].start } },
        select: { createdAt: true },
      }),
      prisma.activity.findMany({
        where: { type: "EMAIL_SENT", createdAt: { gte: months[0].start } },
        select: { createdAt: true },
      }),
      prisma.email.findMany({
        where: { direction: "OUTBOUND", createdAt: { gte: months[0].start } },
        select: { createdAt: true },
      }),
    ])

    const smsDates = smsOut.map((s) => s.createdAt)
    const allEmailDates = [
      ...emailAct.map((e) => e.createdAt),
      ...emailOut.map((e) => e.createdAt),
    ].sort((a, b) => a.getTime() - b.getTime())

    const groupByMonth = (dates: Date[]) =>
      months.map((m) => ({
        month: m.label,
        count: dates.filter((d) => d >= m.start && d <= m.end).length,
      }))

    const smsLast30 = smsDates.filter((d) => d >= days30ago).length
    const emailLast30 = allEmailDates.filter((d) => d >= days30ago).length
    const smsLast7 = smsDates.filter((d) => d >= days7ago).length
    const emailLast7 = allEmailDates.filter((d) => d >= days7ago).length
    const smsCost = smsLast30 * 0.0075
    const emailCost = Math.max(0, emailLast30 - 3000) * 0.001

    messagingVolume = {
      smsMonthly: groupByMonth(smsDates),
      emailMonthly: groupByMonth(allEmailDates),
      totals: { smsLast30, emailLast30, smsLast7, emailLast7, smsCost, emailCost },
    }
  } catch (e) {
    console.error("Messaging volume error:", e)
  }

  return (
    <ReportsClient
      contactsByMonth={contactsByMonth}
      tasksByStatus={JSON.parse(JSON.stringify(tasksByStatus))}
      transactionsByStatus={JSON.parse(JSON.stringify(transactionsByStatus))}
      topLeadSources={JSON.parse(JSON.stringify(topLeadSources))}
      revenueByMonth={revenueByMonth}
      pipelineByStage={JSON.parse(JSON.stringify(pipelineByStage))}
      messagingVolume={messagingVolume}
    />
  )
}
