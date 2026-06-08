export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import AIAgentClient from "./ai-agent-client"
import { getAIConfig } from "@/lib/ai-agent"

export default async function AIAgentPage() {
  const session = await auth()

  const [notifications, recentConversations, config, rawStats, ftboPlan, preQualStats] = await Promise.all([
    prisma.aINotification.findMany({
      include: { contact: { select: { id: true, firstName: true, lastName: true, phone: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.aIConversation.findMany({
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    getAIConfig(),
    Promise.all([
      prisma.aINotification.count(),
      prisma.aINotification.count({ where: { isRead: false } }),
      prisma.sMSMessage.count({ where: { direction: "OUTBOUND" } }),
      prisma.email.count({ where: { status: "SENT" } }),
    ]),
    prisma.smartPlan.findFirst({
      where: { name: { contains: "Primera Vez" } },
      include: {
        steps: { orderBy: { order: "asc" } },
        enrollments: { where: { status: "ACTIVE" }, select: { id: true } },
      },
    }),
    Promise.all([
      prisma.contact.count({ where: { isArchived: false } }),
      prisma.contact.count({
        where: {
          isArchived: false,
          activities: { some: { type: "AI_TRIGGERED" } },
        },
      }),
      prisma.task.count({
        where: {
          title: { contains: "Llamar" },
          status: { not: "COMPLETED" },
        },
      }),
    ]),
  ])

  const [totalNotifications, unreadCount, smsSent, emailsSent] = rawStats
  const [totalContacts, aiTouched, pendingCalls] = preQualStats

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600000)

  // Hot leads and insights — query DB directly (no self-fetch)
  const [hotLeads, needsFollowUp, allWithBirthday, newUncontacted] = await Promise.all([
    prisma.contact.findMany({
      where: { isArchived: false, leadScore: { gte: 40 } },
      orderBy: { leadScore: "desc" },
      take: 8,
      select: {
        id: true, firstName: true, lastName: true, phone: true,
        leadScore: true, status: true, lastContacted: true,
        propertyViews: { where: { createdAt: { gte: sevenDaysAgo } }, select: { id: true } },
      },
    }),
    prisma.contact.findMany({
      where: {
        isArchived: false,
        leadScore: { gte: 20 },
        OR: [
          { lastContacted: null },
          { lastContacted: { lte: new Date(now.getTime() - 14 * 24 * 3600000) } },
        ],
        propertyViews: { some: { createdAt: { gte: sevenDaysAgo } } },
      },
      orderBy: { leadScore: "desc" },
      take: 5,
      select: {
        id: true, firstName: true, lastName: true, phone: true,
        leadScore: true, lastContacted: true,
        propertyViews: { where: { createdAt: { gte: sevenDaysAgo } }, select: { id: true } },
      },
    }),
    prisma.contact.findMany({
      where: { birthday: { not: null }, isArchived: false },
      select: { id: true, firstName: true, lastName: true, birthday: true },
    }),
    prisma.contact.count({
      where: { isArchived: false, createdAt: { gte: thirtyDaysAgo }, lastContacted: null, status: "LEAD" },
    }),
  ])

  // Filter upcoming birthdays (next 7 days)
  const birthdays = allWithBirthday
    .map(c => {
      const b = c.birthday!
      const thisYear = new Date(now.getFullYear(), b.getMonth(), b.getDate())
      const daysUntil = Math.round((thisYear.getTime() - now.getTime()) / (24 * 3600000))
      return { ...c, daysUntil }
    })
    .filter(c => c.daysUntil >= 0 && c.daysUntil <= 7)
    .sort((a, b) => a.daysUntil - b.daysUntil)

  const insights = {
    hotLeads: hotLeads.map(c => ({ ...c, recentViews: c.propertyViews.length, propertyViews: undefined })),
    needsFollowUp: needsFollowUp.map(c => ({ ...c, recentViews: c.propertyViews.length, propertyViews: undefined })),
    birthdays,
    likelySellers: [],
    newUncontacted,
  }

  return (
    <AIAgentClient
      notifications={JSON.parse(JSON.stringify(notifications))}
      conversations={JSON.parse(JSON.stringify(recentConversations))}
      config={JSON.parse(JSON.stringify(config))}
      stats={{ totalNotifications, unreadCount, smsSent, emailsSent }}
      ftboPlan={ftboPlan ? JSON.parse(JSON.stringify(ftboPlan)) : null}
      preQualStats={{ totalContacts, aiTouched, pendingCalls }}
      insights={JSON.parse(JSON.stringify(insights))}
    />
  )
}
