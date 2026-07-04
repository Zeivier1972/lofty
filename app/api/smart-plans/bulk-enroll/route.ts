export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * POST /api/smart-plans/bulk-enroll
 * Enrolls all matching contacts into a smart plan.
 * body: { planName: string, tagNames?: string[], pipelineNames?: string[] }
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { planName, tagNames = [], pipelineNames = [] } = await req.json()
    if (!planName) return NextResponse.json({ error: "planName is required" }, { status: 400 })
    if (!tagNames.length && !pipelineNames.length) {
      return NextResponse.json({ error: "Provide at least one tagNames or pipelineNames" }, { status: 400 })
    }

    // Find the smart plan by name (case-insensitive partial match)
    const plan = await prisma.smartPlan.findFirst({
      where: { name: { contains: planName, mode: "insensitive" } },
      include: { steps: { orderBy: { order: "asc" }, take: 1 } },
    })
    if (!plan) return NextResponse.json({ error: `Smart plan not found: "${planName}"` }, { status: 404 })

    const contactIds = new Set<string>()

    // Find contacts by tag names
    if (tagNames.length > 0) {
      const tags = await prisma.tag.findMany({
        where: { name: { in: tagNames, } },
      })
      if (tags.length > 0) {
        const tagContacts = await prisma.contactTag.findMany({
          where: { tagId: { in: tags.map(t => t.id) } },
          select: { contactId: true },
        })
        tagContacts.forEach(c => contactIds.add(c.contactId))
      }
    }

    // Find contacts by pipeline/stage names
    if (pipelineNames.length > 0) {
      const stages = await prisma.pipelineStage.findMany({
        where: { name: { in: pipelineNames, } },
      })
      if (stages.length > 0) {
        const pipelineContacts = await prisma.pipelineLead.findMany({
          where: { stageId: { in: stages.map(s => s.id) } },
          select: { contactId: true },
        })
        pipelineContacts.forEach(c => contactIds.add(c.contactId))
      }

      // Also try matching pipeline names directly (pipeline.name contains the term)
      const pipelines = await prisma.pipeline.findMany({
        where: { name: { in: pipelineNames } },
        include: { stages: { select: { id: true } } },
      })
      if (pipelines.length > 0) {
        const allStageIds = pipelines.flatMap(p => p.stages.map(s => s.id))
        const pipelineContacts = await prisma.pipelineLead.findMany({
          where: { stageId: { in: allStageIds } },
          select: { contactId: true },
        })
        pipelineContacts.forEach(c => contactIds.add(c.contactId))
      }
    }

    if (contactIds.size === 0) {
      return NextResponse.json({ enrolled: 0, skipped: 0, message: "No matching contacts found" })
    }

    // Get already-enrolled contacts
    const alreadyEnrolled = await prisma.smartPlanEnrollment.findMany({
      where: { planId: plan.id, contactId: { in: Array.from(contactIds) }, status: "ACTIVE" },
      select: { contactId: true },
    })
    const enrolledSet = new Set(alreadyEnrolled.map(e => e.contactId))

    const toEnroll = Array.from(contactIds).filter(id => !enrolledSet.has(id))
    const delay = plan.steps[0]?.delay ?? 0
    const nextStepAt = new Date(Date.now() + delay * 24 * 60 * 60 * 1000)

    // Bulk create enrollments in batches of 50
    let enrolled = 0
    const BATCH = 50
    for (let i = 0; i < toEnroll.length; i += BATCH) {
      const batch = toEnroll.slice(i, i + BATCH)
      await prisma.smartPlanEnrollment.createMany({
        data: batch.map(contactId => ({
          planId: plan.id,
          contactId,
          status: "ACTIVE",
          currentStep: 0,
          nextStepAt,
        })),
        skipDuplicates: true,
      })
      enrolled += batch.length
    }

    return NextResponse.json({
      ok: true,
      planName: plan.name,
      enrolled,
      skipped: enrolledSet.size,
      total: contactIds.size,
    })
  } catch (e) {
    console.error("Bulk enroll error:", e)
    return NextResponse.json({ error: "Failed to bulk enroll" }, { status: 500 })
  }
}
