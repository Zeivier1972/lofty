export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import BookingClient from "./booking-client"

export default async function BookPage() {
  const [aiConfig, agent] = await Promise.all([
    prisma.aIConfig.findFirst(),
    prisma.user.findFirst({ where: { isActive: true }, select: { name: true, title: true, avatar: true, phone: true } }),
  ])

  if (aiConfig?.calendlyUrl) {
    redirect(aiConfig.calendlyUrl)
  }

  return (
    <BookingClient
      agentName={aiConfig?.realtorName || agent?.name || "Catherine"}
      agentTitle={agent?.title || "Agente de Bienes Raíces"}
    />
  )
}
