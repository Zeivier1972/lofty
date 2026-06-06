export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import DashboardClient from "./dashboard-client"

export default async function DashboardPage() {
  const session = await auth()
  const userId = session?.user?.id

  const [
    totalContacts,
    newLeadsThisMonth,
    activeTransactions,
    tasks,
    appointments,
    recentActivities,
    pipelineData,
    contactsByStatus,
    tasksDueToday,
  ] = await Promise.all([
    prisma.contact.count({ where: { isArchived: false } }),
    prisma.contact.count({
      where: {
        createdAt: { gte: new Date(new Date().setDate(1)) },
        isArchived: false,
      },
    }),
    prisma.transaction.count({
      where: { status: { in: ["ACTIVE_LISTING", "UNDER_CONTRACT"] } },
    }),
    prisma.task.findMany({
      where: { status: { in: ["PENDING", "IN_PROGRESS"] }, assignedToId: userId },
      include: { contact: true },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      take: 8,
    }),
    prisma.appointment.findMany({
      where: {
        startTime: { gte: new Date() },
        userId,
        status: { in: ["SCHEDULED", "CONFIRMED"] },
      },
      include: { contact: true },
      orderBy: { startTime: "asc" },
      take: 5,
    }),
    prisma.activity.findMany({
      include: { contact: true, user: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.pipelineStage.findMany({
      where: { pipeline: { isDefault: true } },
      include: { leads: { include: { contact: true } } },
      orderBy: { order: "asc" },
    }),
    prisma.contact.groupBy({
      by: ["status"],
      _count: true,
      where: { isArchived: false },
    }),
    prisma.task.count({
      where: {
        status: { in: ["PENDING", "IN_PROGRESS"] },
        dueDate: {
          lte: new Date(new Date().setHours(23, 59, 59, 999)),
        },
        assignedToId: userId,
      },
    }),
  ])

  const pipelineValue = pipelineData.reduce((sum, stage) => {
    return sum + stage.leads.reduce((s, lead) => s + (lead.value || 0), 0)
  }, 0)

  const closedTransactions = await prisma.transaction.aggregate({
    where: { status: "CLOSED" },
    _sum: { salePrice: true },
  })

  const stats = {
    totalContacts,
    newLeadsThisMonth,
    activeTransactions,
    pipelineValue,
    closedVolume: closedTransactions._sum.salePrice || 0,
    tasksDueToday,
    pendingTasks: tasks.length,
    upcomingAppointments: appointments.length,
  }

  return (
    <DashboardClient
      stats={stats}
      tasks={JSON.parse(JSON.stringify(tasks))}
      appointments={JSON.parse(JSON.stringify(appointments))}
      recentActivities={JSON.parse(JSON.stringify(recentActivities))}
      pipelineData={JSON.parse(JSON.stringify(pipelineData))}
      contactsByStatus={JSON.parse(JSON.stringify(contactsByStatus))}
    />
  )
}
