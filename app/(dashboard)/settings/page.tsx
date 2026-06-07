export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import SettingsClient from "./settings-client"

export default async function SettingsPage() {
  let user = null
  let tags: any[] = []
  let pipelines: any[] = []

  try {
    const session = await auth()
    const userId = session?.user?.id

    ;[tags, pipelines] = await Promise.all([
      prisma.tag.findMany({ orderBy: { name: "asc" } }),
      prisma.pipeline.findMany({ include: { stages: { orderBy: { order: "asc" } } }, orderBy: { createdAt: "asc" } }),
    ])

    // Auto-seed a default pipeline so stages can be added immediately
    if (pipelines.length === 0) {
      const defaultPipeline = await prisma.pipeline.create({
        data: {
          name: "Sales Pipeline",
          isDefault: true,
          stages: {
            create: [
              { name: "New Lead", color: "#6366F1", order: 0 },
              { name: "Contacted", color: "#3B82F6", order: 1 },
              { name: "Showing", color: "#F59E0B", order: 2 },
              { name: "Under Contract", color: "#10B981", order: 3 },
              { name: "Closed", color: "#22C55E", order: 4 },
            ],
          },
        },
        include: { stages: { orderBy: { order: "asc" } } },
      })
      pipelines = [defaultPipeline]
    }

    if (userId) {
      user = await prisma.user.findUnique({ where: { id: userId } })
    }
  } catch (e) {
    console.error("Settings page error:", e)
  }

  return (
    <SettingsClient
      user={JSON.parse(JSON.stringify(user))}
      tags={JSON.parse(JSON.stringify(tags))}
      pipelines={JSON.parse(JSON.stringify(pipelines))}
    />
  )
}
