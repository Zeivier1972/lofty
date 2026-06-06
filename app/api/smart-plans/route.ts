export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  try {
    const plans = await prisma.smartPlan.findMany({
      include: {
        steps: { orderBy: { order: "asc" } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(plans)
  } catch {
    return NextResponse.json({ error: "Failed to fetch plans" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { name, description, trigger, steps } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 })

    const plan = await prisma.smartPlan.create({
      data: {
        name,
        description,
        trigger: trigger || "MANUAL",
        userId: session?.user?.id as string,
        steps: {
          create: (steps || []).map((s: any, i: number) => ({
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

    return NextResponse.json(plan, { status: 201 })
  } catch (e) {
    console.error("Smart plan create error:", e)
    return NextResponse.json({ error: "Failed to create plan" }, { status: 500 })
  }
}
