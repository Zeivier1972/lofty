export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * POST /api/smart-plans/bulk-enroll
 * Enrolls matching contacts into a smart plan.
 * body: {
 *   planName: string,
 *   tagNames?: string[],
 *   pipelineNames?: string[],
 *   importedOnly?: boolean,          // only Lofty-imported contacts (have loftyId in customFields)
 *   excludeTagNames?: string[],      // remove contacts with these tags
 *   excludePipelineNames?: string[], // remove contacts in these pipelines
 * }
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const {
      planName,
      tagNames = [],
      pipelineNames = [],
      importedOnly = false,
      excludeTagNames = [],
      excludePipelineNames = [],
    } = await req.json()

    if (!planName) return NextResponse.json({ error: "planName is required" }, { status: 400 })
    if (!tagNames.length && !pipelineNames.length && !importedOnly) {
      return NextResponse.json(
        { error: "Provide at least one of: tagNames, pipelineNames, or importedOnly:true" },
        { status: 400 }
      )
    }

    // Find the smart plan by name (case-insensitive partial match)
    const plan = await prisma.smartPlan.findFirst({
      where: { name: { contains: planName, mode: "insensitive" } },
      include: { steps: { orderBy: { order: "asc" }, take: 1 } },
    })
    if (!plan) return NextResponse.json({ error: `Smart plan not found: "${planName}"` }, { status: 404 })

    const contactIds = new Set<string>()

    // All Lofty-imported contacts (customFields JSON contains loftyId key)
    if (importedOnly) {
      const imported = await prisma.contact.findMany({
        where: { customFields: { contains: '"loftyId"' } },
        select: { id: true },
      })
      imported.forEach(c => contactIds.add(c.id))
    }

    // Find contacts by tag names
    if (tagNames.length > 0) {
      const tags = await prisma.tag.findMany({ where: { name: { in: tagNames } } })
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
      const stages = await prisma.pipelineStage.findMany({ where: { name: { in: pipelineNames } } })
      if (stages.length > 0) {
        const pipelineContacts = await prisma.pipelineLead.findMany({
          where: { stageId: { in: stages.map(s => s.id) } },
          select: { contactId: true },
        })
        pipelineContacts.forEach(c => contactIds.add(c.contactId))
      }

      // Also match by pipeline name directly
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

    // Build exclusion set
    const excludeIds = new Set<string>()

    if (excludeTagNames.length > 0) {
      const exTags = await prisma.tag.findMany({ where: { name: { in: excludeTagNames } } })
      if (exTags.length > 0) {
        const exTagContacts = await prisma.contactTag.findMany({
          where: { tagId: { in: exTags.map(t => t.id) } },
          select: { contactId: true },
        })
        exTagContacts.forEach(c => excludeIds.add(c.contactId))
      }
    }

    if (excludePipelineNames.length > 0) {
      // By stage name
      const exStages = await prisma.pipelineStage.findMany({ where: { name: { in: excludePipelineNames } } })
      if (exStages.length > 0) {
        const exStageContacts = await prisma.pipelineLead.findMany({
          where: { stageId: { in: exStages.map(s => s.id) } },
          select: { contactId: true },
        })
        exStageContacts.forEach(c => excludeIds.add(c.contactId))
      }
      // By pipeline name
      const exPipelines = await prisma.pipeline.findMany({
        where: { name: { in: excludePipelineNames } },
        include: { stages: { select: { id: true } } },
      })
      if (exPipelines.length > 0) {
        const exAllStageIds = exPipelines.flatMap(p => p.stages.map(s => s.id))
        const exPipelineContacts = await prisma.pipelineLead.findMany({
          where: { stageId: { in: exAllStageIds } },
          select: { contactId: true },
        })
        exPipelineContacts.forEach(c => excludeIds.add(c.contactId))
      }
    }

    // Apply exclusions
    const eligibleIds = Array.from(contactIds).filter(id => !excludeIds.has(id))

    if (eligibleIds.length === 0) {
      return NextResponse.json({ enrolled: 0, skipped: 0, excluded: excludeIds.size, message: "All matching contacts were excluded" })
    }

    // Get already-enrolled contacts
    const alreadyEnrolled = await prisma.smartPlanEnrollment.findMany({
      where: { planId: plan.id, contactId: { in: eligibleIds }, status: "ACTIVE" },
      select: { contactId: true },
    })
    const enrolledSet = new Set(alreadyEnrolled.map(e => e.contactId))

    const toEnroll = eligibleIds.filter(id => !enrolledSet.has(id))
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
      excluded: excludeIds.size,
      total: contactIds.size,
    })
  } catch (e) {
    console.error("Bulk enroll error:", e)
    return NextResponse.json({ error: "Failed to bulk enroll" }, { status: 500 })
  }
}
