export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { contactId } = await req.json()
    if (!contactId) return NextResponse.json({ error: "contactId is required" }, { status: 400 })

    const plan = await prisma.smartPlan.findUnique({
      where: { id: params.id },
      include: { steps: { orderBy: { order: "asc" }, take: 1 } },
    })
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })

    // Upsert: if already enrolled and completed/stopped, re-enroll; otherwise skip duplicates
    const existing = await prisma.smartPlanEnrollment.findFirst({
      where: { planId: params.id, contactId, status: "ACTIVE" },
    })
    if (existing) {
      return NextResponse.json({ error: "Already enrolled in this plan" }, { status: 409 })
    }

    const delay = plan.steps[0]?.delay ?? 0
    const nextStepAt = new Date(Date.now() + delay * 24 * 60 * 60 * 1000)

    const enrollment = await prisma.smartPlanEnrollment.create({
      data: {
        planId: params.id,
        contactId,
        status: "ACTIVE",
        currentStep: 0,
        nextStepAt,
      },
      include: { plan: true },
    })

    return NextResponse.json(enrollment, { status: 201 })
  } catch (e) {
    console.error("Enroll error:", e)
    return NextResponse.json({ error: "Failed to enroll" }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { contactId } = await req.json()
    if (!contactId) return NextResponse.json({ error: "contactId is required" }, { status: 400 })

    await prisma.smartPlanEnrollment.deleteMany({
      where: { planId: params.id, contactId },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: "Failed to unenroll" }, { status: 500 })
  }
}
