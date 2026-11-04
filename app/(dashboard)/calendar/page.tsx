export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import CalendarClient from "./calendar-client"

export default async function CalendarPage() {
  let appointments: any[] = []

  try {
    const session = await auth()
    const userId = session?.user?.id

    // The calendar only loaded the current month (and stopped at midnight of
    // its last day), while the dashboard counts every upcoming appointment —
    // so "2 upcoming appointments" pointed at an empty calendar whenever they
    // were next month. The client switches months without fetching, so load
    // a window: 2 months back through 12 months ahead.
    const now = new Date()
    const from = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    const to = new Date(now.getFullYear(), now.getMonth() + 13, 1)

    appointments = await prisma.appointment.findMany({
      where: {
        ...(userId && { userId }),
        startTime: { gte: from, lt: to },
        status: { not: "CANCELLED" },
      },
      include: { contact: { select: { id: true, firstName: true, lastName: true, phone: true } } },
      orderBy: { startTime: "asc" },
    })
  } catch (e) {
    console.error("Calendar page error:", e)
  }

  return <CalendarClient appointments={JSON.parse(JSON.stringify(appointments))} />
}
