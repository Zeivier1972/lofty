export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// POST — add a tag to a contact
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { tagId } = await req.json()
  if (!tagId) return NextResponse.json({ error: "tagId required" }, { status: 400 })

  await prisma.contactTag.upsert({
    where: { contactId_tagId: { contactId: params.id, tagId } },
    create: { contactId: params.id, tagId },
    update: {},
  })

  // Auto-enroll in any CONTACT_TAGGED smart plans matching this tag
  const plans = await prisma.smartPlan.findMany({
    where: { isActive: true, trigger: `CONTACT_TAGGED:${tagId}` },
    include: { steps: { where: { order: 0 }, take: 1 } },
  })
  for (const plan of plans) {
    const already = await prisma.smartPlanEnrollment.findFirst({
      where: { contactId: params.id, planId: plan.id, status: "ACTIVE" },
    })
    if (!already) {
      const delay = plan.steps[0]?.delay ?? 0
      await prisma.smartPlanEnrollment.create({
        data: {
          contactId: params.id,
          planId: plan.id,
          status: "ACTIVE",
          currentStep: 0,
          nextStepAt: new Date(Date.now() + delay * 86400000),
        },
      })
    }
  }

  return NextResponse.json({ success: true })
}

// DELETE — remove a tag from a contact
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { tagId } = await req.json()
  if (!tagId) return NextResponse.json({ error: "tagId required" }, { status: 400 })

  await prisma.contactTag.deleteMany({
    where: { contactId: params.id, tagId },
  })

  return NextResponse.json({ success: true })
}
