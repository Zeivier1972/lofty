export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import SmartPlansClient from "./smart-plans-client"

export default async function SmartPlansPage() {
  let plans: any[] = []

  try {
    const session = await auth()
    const userId = session?.user?.id

    plans = await prisma.smartPlan.findMany({
      where: { ...(userId && { userId }) },
      include: {
        steps: { orderBy: { order: "asc" } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: "desc" },
    })
  } catch (e) {
    console.error("Smart plans page error:", e)
  }

  return <SmartPlansClient plans={JSON.parse(JSON.stringify(plans))} />
}
