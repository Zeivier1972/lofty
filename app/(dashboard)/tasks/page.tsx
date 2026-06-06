export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import TasksClient from "./tasks-client"

export default async function TasksPage({ searchParams }: { searchParams: { status?: string; priority?: string } }) {
  let tasks: any[] = []
  let counts: any[] = []

  try {
    const session = await auth()
    const userId = session?.user?.id

    const where: any = { ...(userId && { assignedToId: userId }) }
    if (searchParams.status && searchParams.status !== "ALL") where.status = searchParams.status
    if (searchParams.priority && searchParams.priority !== "ALL") where.priority = searchParams.priority

    ;[tasks, counts] = await Promise.all([
      prisma.task.findMany({
        where,
        include: { contact: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } } },
        orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      }),
      prisma.task.groupBy({
        by: ["status"],
        where: { ...(userId && { assignedToId: userId }) },
        _count: true,
      }),
    ])
  } catch (e) {
    console.error("Tasks page error:", e)
  }

  return (
    <TasksClient
      tasks={JSON.parse(JSON.stringify(tasks))}
      counts={JSON.parse(JSON.stringify(counts))}
      filters={{ status: searchParams.status, priority: searchParams.priority }}
    />
  )
}
