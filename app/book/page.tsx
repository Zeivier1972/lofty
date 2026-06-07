export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import BookingClient from "./booking-client"

export default async function BookPage() {
  // Get agent info from AIConfig + User
  const [aiConfig, agent] = await Promise.all([
    prisma.aIConfig.findFirst(),
    prisma.user.findFirst({ where: { isActive: true }, select: { name: true, title: true, avatar: true, phone: true } }),
  ])

  return (
    <BookingClient
      agentName={aiConfig?.realtorName || agent?.name || "Catherine"}
      agentTitle={agent?.title || "Agente de Bienes Raíces"}
    />
  )
}
