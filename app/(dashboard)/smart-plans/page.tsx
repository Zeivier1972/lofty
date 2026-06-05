import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import SmartPlansClient from "./smart-plans-client"

export default async function SmartPlansPage() {
  const session = await auth()
  const userId = session?.user?.id

  const plans = await prisma.smartPlan.findMany({
    where: { userId },
    include: {
      steps: { orderBy: { order: "asc" } },
      _count: { select: { enrollments: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return <SmartPlansClient plans={JSON.parse(JSON.stringify(plans))} />
}
