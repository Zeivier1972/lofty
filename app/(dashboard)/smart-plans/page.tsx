export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import SmartPlansClient from "./smart-plans-client"

export default async function SmartPlansPage() {
  let plans: any[] = []
  let tags: any[] = []

  try {
    const session = await auth()
    const userId = session?.user?.id

    ;[plans, tags] = await Promise.all([
      prisma.smartPlan.findMany({
        where: userId ? { OR: [{ userId }, { userId: null }] } : {},
        include: {
          steps: { orderBy: { order: "asc" } },
          _count: { select: { enrollments: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.tag.findMany({ orderBy: { name: "asc" } }),
    ])
  } catch (e) {
    console.error("Smart plans page error:", e)
  }

  return <SmartPlansClient plans={JSON.parse(JSON.stringify(plans))} tags={JSON.parse(JSON.stringify(tags))} />
}
