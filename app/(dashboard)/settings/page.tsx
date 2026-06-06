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
