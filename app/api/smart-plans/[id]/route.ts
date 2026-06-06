export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { name, description, trigger, isActive, steps } = await req.json()

    if (steps !== undefined) {
      // Full plan update with steps: delete old steps and recreate
      await prisma.smartPlanStep.deleteMany({ where: { planId: params.id } })
      const plan = await prisma.smartPlan.update({
        where: { id: params.id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(trigger !== undefined && { trigger }),
          ...(isActive !== undefined && { isActive }),
          steps: {
            create: steps.map((s: any, i: number) => ({
              order: i,
              type: s.type,
              delay: s.delay ?? 0,
              subject: s.subject,
              content: s.content,
              taskTitle: s.taskTitle,
              taskType: s.taskType,
            })),
          },
        },
        include: {
          steps: { orderBy: { order: "asc" } },
          _count: { select: { enrollments: true } },
        },
      })
      return NextResponse.json(plan)
    }

    // Simple field update (e.g. toggle isActive)
    const plan = await prisma.smartPlan.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(trigger !== undefined && { trigger }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        steps: { orderBy: { order: "asc" } },
        _count: { select: { enrollments: true } },
      },
    })
    return NextResponse.json(plan)
  } catch (e) {
    console.error("Smart plan update error:", e)
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    await prisma.smartPlanStep.deleteMany({ where: { planId: params.id } })
    await prisma.smartPlanEnrollment.deleteMany({ where: { planId: params.id } })
    await prisma.smartPlan.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("Smart plan delete error:", e)
    return NextResponse.json({ error: "Failed to delete plan" }, { status: 500 })
  }
}
