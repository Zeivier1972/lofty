import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import SettingsClient from "./settings-client"

export default async function SettingsPage() {
  const session = await auth()
  const userId = session?.user?.id

  const [user, tags, pipelines] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    prisma.pipeline.findMany({ include: { stages: { orderBy: { order: "asc" } } }, orderBy: { createdAt: "asc" } }),
  ])

  return (
    <SettingsClient
      user={JSON.parse(JSON.stringify(user))}
      tags={JSON.parse(JSON.stringify(tags))}
      pipelines={JSON.parse(JSON.stringify(pipelines))}
    />
  )
}
