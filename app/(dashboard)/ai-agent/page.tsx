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

  // Fetch AI insights (hot leads, upcoming birthdays, etc.)
  let insights: any = null
  try {
    const insightsRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/ai/insights`, {
      headers: { cookie: "" },
      cache: "no-store",
    })
    if (insightsRes.ok) insights = await insightsRes.json()
  } catch {
    // Insights are non-critical
  }

  // Fallback: compute hot leads directly
  if (!insights) {
    const hotLeads = await prisma.contact.findMany({
      where: { isArchived: false, leadScore: { gte: 40 } },
      orderBy: { leadScore: "desc" },
      take: 8,
      select: { id: true, firstName: true, lastName: true, phone: true, leadScore: true, status: true, lastContacted: true },
    })
    insights = { hotLeads, needsFollowUp: [], birthdays: [], likelySellers: [], newUncontacted: 0 }
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
