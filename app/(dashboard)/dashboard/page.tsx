export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import DashboardClient from "./dashboard-client"

export default async function DashboardPage() {
  let stats = {
    totalContacts: 0, newLeadsThisMonth: 0, activeTransactions: 0,
    pipelineValue: 0, closedVolume: 0, tasksDueToday: 0,
    pendingTasks: 0, upcomingAppointments: 0,
  }
  let tasks: any[] = []
  let appointments: any[] = []
  let recentActivities: any[] = []
  let pipelineData: any[] = []
  let contactsByStatus: any[] = []
  let hotAlerts: any[] = []
  let matchAlertsSentToday = 0
  let newLeadsToday = 0
  let portalUnread = 0

  try {
    const session = await auth()
    const userId = session?.user?.id

    const todayStart = new Date(new Date().setHours(0, 0, 0, 0))

    const [
      totalContacts, newLeadsThisMonth, activeTransactions,
      tasksData, appointmentsData, recentActivitiesData,
      pipelineDataRaw, contactsByStatusData, tasksDueToday,
      hotAlertsData, matchAlertsTodayCount, newLeadsTodayCount, portalUnreadCount,
    ] = await Promise.all([
      prisma.contact.count({ where: { isArchived: false } }),
      prisma.contact.count({ where: { createdAt: { gte: new Date(new Date().setDate(1)) }, isArchived: false } }),
      prisma.transaction.count({ where: { status: { in: ["ACTIVE_LISTING", "UNDER_CONTRACT"] } } }),
      prisma.task.findMany({
        where: { status: { in: ["PENDING", "IN_PROGRESS"] }, ...(userId && { assignedToId: userId }) },
        include: { contact: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
        take: 8,
      }),
      prisma.appointment.findMany({
        where: { startTime: { gte: new Date() }, ...(userId && { userId }), status: { in: ["SCHEDULED", "CONFIRMED"] } },
        include: { contact: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { startTime: "asc" },
        take: 5,
      }),
      prisma.activity.findMany({
        select: {
          id: true, type: true, title: true, createdAt: true,
          contact: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      // Only lead values are needed for the pipeline chart — not full contact records
      prisma.pipelineStage.findMany({
        where: { pipeline: { isDefault: true } },
        select: { id: true, name: true, leads: { select: { value: true } } },
        orderBy: { order: "asc" },
      }),
      prisma.contact.groupBy({ by: ["status"], _count: true, where: { isArchived: false } }),
      prisma.task.count({
        where: {
          status: { in: ["PENDING", "IN_PROGRESS"] },
          dueDate: { lte: new Date(new Date().setHours(23, 59, 59, 999)) },
          ...(userId && { assignedToId: userId }),
        },
      }),
      prisma.aINotification.findMany({
        where: { type: "HOT_ALERT", isRead: false },
        include: { contact: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      // Count actual alert EMAILS (one Email row per email), not per-listing
      // activities — those over-count ~5x since each email carries several homes.
      prisma.email.count({ where: { direction: "OUTBOUND", status: "SENT", createdAt: { gte: todayStart }, subject: { contains: "Sofia found" } } }),
      prisma.contact.count({ where: { createdAt: { gte: todayStart }, isArchived: false } }),
      prisma.portalMessage.count({ where: { isRead: false, fromClient: true } }),
    ])

    tasks = tasksData
    appointments = appointmentsData
    recentActivities = recentActivitiesData
    pipelineData = pipelineDataRaw
    contactsByStatus = contactsByStatusData
    hotAlerts = hotAlertsData
    matchAlertsSentToday = matchAlertsTodayCount
    newLeadsToday = newLeadsTodayCount
    portalUnread = portalUnreadCount

    const pipelineValue = pipelineDataRaw.reduce((sum, stage) =>
      sum + stage.leads.reduce((s: number, lead: any) => s + (lead.value || 0), 0), 0)

    const closedTransactions = await prisma.transaction.aggregate({
      where: { status: "CLOSED" },
      _sum: { salePrice: true },
    })

    stats = {
      totalContacts, newLeadsThisMonth, activeTransactions,
      pipelineValue, closedVolume: closedTransactions._sum.salePrice || 0,
      tasksDueToday, pendingTasks: tasksData.length,
      upcomingAppointments: appointmentsData.length,
    }
  } catch (e) {
    console.error("Dashboard page error:", e)
  }

  return (
    <DashboardClient
      stats={stats}
      tasks={JSON.parse(JSON.stringify(tasks))}
      appointments={JSON.parse(JSON.stringify(appointments))}
      recentActivities={JSON.parse(JSON.stringify(recentActivities))}
      pipelineData={JSON.parse(JSON.stringify(pipelineData))}
      contactsByStatus={JSON.parse(JSON.stringify(contactsByStatus))}
      hotAlerts={JSON.parse(JSON.stringify(hotAlerts))}
      matchAlertsSentToday={matchAlertsSentToday}
      newLeadsToday={newLeadsToday}
      portalUnread={portalUnread}
    />
  )
}
