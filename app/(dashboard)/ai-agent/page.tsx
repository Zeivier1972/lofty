import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import AIAgentClient from "./ai-agent-client"
import { getAIConfig } from "@/lib/ai-agent"

export default async function AIAgentPage() {
  const session = await auth()

  const [notifications, recentConversations, config, stats] = await Promise.all([
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
  ])

  const [totalNotifications, unreadCount, smsSent, emailsSent] = stats

  return (
    <AIAgentClient
      notifications={JSON.parse(JSON.stringify(notifications))}
      conversations={JSON.parse(JSON.stringify(recentConversations))}
      config={JSON.parse(JSON.stringify(config))}
      stats={{ totalNotifications, unreadCount, smsSent, emailsSent }}
    />
  )
}
