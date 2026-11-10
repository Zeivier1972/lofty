export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

/**
 * POST /api/tasks/cancel-all — the "Cancelar todas" button on /tasks.
 *
 * Marks every open task (PENDING or IN_PROGRESS) of the signed-in user, plus
 * unassigned ones, as CANCELLED. Cancelling instead of deleting keeps the
 * history on each contact and lets a task be reopened. Completed tasks are
 * left alone. New tasks (smart plans, Sofía) keep being created afterwards.
 */
export async function POST() {
  const session = await auth()
  const userId = session?.user?.id
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const res = await prisma.task.updateMany({
    where: {
      status: { in: ["PENDING", "IN_PROGRESS"] },
      ...(userId ? { OR: [{ assignedToId: userId }, { assignedToId: null }] } : {}),
    },
    data: { status: "CANCELLED" },
  })
  return NextResponse.json({ cancelled: res.count })
}
