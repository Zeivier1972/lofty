export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import CalendarClient from "./calendar-client"

export default async function CalendarPage() {
  const session = await auth()
  const userId = session?.user?.id

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const appointments = await prisma.appointment.findMany({
    where: {
      userId,
      startTime: { gte: startOfMonth, lte: endOfMonth },
    },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
    },
    orderBy: { startTime: "asc" },
  })

  return <CalendarClient appointments={JSON.parse(JSON.stringify(appointments))} />
}
