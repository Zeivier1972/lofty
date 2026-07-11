export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// PATCH: move multiple leads to a stage
// body: { ids: string[], stageId: string }
export async function PATCH(req: Request) {
  try {
    const { ids, stageId } = await req.json()
    if (!ids?.length || !stageId) {
      return NextResponse.json({ error: "ids and stageId required" }, { status: 400 })
    }

    const stage = await prisma.pipelineStage.findUnique({ where: { id: stageId } })
    if (!stage) return NextResponse.json({ error: "Stage not found" }, { status: 404 })

    await prisma.pipelineLead.updateMany({ where: { id: { in: ids } }, data: { stageId } })

    // Log activity for each contact
    const leads = await prisma.pipelineLead.findMany({ where: { id: { in: ids } }, select: { contactId: true } })
    await prisma.activity.createMany({
      data: leads.map(l => ({
        type: "PIPELINE_MOVED",
        title: `Moved to ${stage.name}`,
        contactId: l.contactId,
      })),
    })

    // Bulk-moving leads = the agent handled them → clear their notifications
    await prisma.aINotification.updateMany({
      where: { contactId: { in: leads.map((l: { contactId: string }) => l.contactId) }, isRead: false },
      data: { isRead: true },
    }).catch(() => {})

    return NextResponse.json({ updated: ids.length })
  } catch (e) {
    console.error("Bulk move error:", e)
    return NextResponse.json({ error: "Failed to move leads" }, { status: 500 })
  }
}

// DELETE: remove multiple leads from pipeline
// body: { ids: string[] }
export async function DELETE(req: Request) {
  try {
    const { ids } = await req.json()
    if (!ids?.length) return NextResponse.json({ error: "ids required" }, { status: 400 })

    await prisma.pipelineLead.deleteMany({ where: { id: { in: ids } } })
    return NextResponse.json({ deleted: ids.length })
  } catch (e) {
    console.error("Bulk delete error:", e)
    return NextResponse.json({ error: "Failed to delete leads" }, { status: 500 })
  }
}

// POST: move/add multiple contacts to a stage by CONTACT id.
// body: { contactIds: string[], stageId: string }
// Contacts already in this pipeline are MOVED to the stage (their existing lead
// is updated); contacts not yet in it are added. This is what "Move to Stage"
// on the Contacts list needs — the old version skipped anyone already staged,
// so moving between stages silently did nothing.
export async function POST(req: Request) {
  try {
    const { contactIds, stageId } = await req.json()
    if (!contactIds?.length || !stageId) {
      return NextResponse.json({ error: "contactIds and stageId required" }, { status: 400 })
    }

    const stage = await prisma.pipelineStage.findUnique({ where: { id: stageId } })
    if (!stage) return NextResponse.json({ error: "Stage not found" }, { status: 404 })

    // Which of these contacts already have a lead in THIS pipeline?
    const existing = await prisma.pipelineLead.findMany({
      where: { contactId: { in: contactIds }, stage: { pipelineId: stage.pipelineId } },
      select: { id: true, contactId: true, stageId: true },
    })
    const existingByContact = new Map(existing.map(e => [e.contactId, e]))

    // Move the ones already in the pipeline whose stage differs
    const toMove = existing.filter(e => e.stageId !== stageId)
    if (toMove.length > 0) {
      await prisma.pipelineLead.updateMany({
        where: { id: { in: toMove.map(e => e.id) } },
        data: { stageId },
      })
    }

    // Create leads for contacts not yet in this pipeline
    const newIds = (contactIds as string[]).filter(id => !existingByContact.has(id))
    if (newIds.length > 0) {
      await prisma.pipelineLead.createMany({
        data: newIds.map(contactId => ({ contactId, stageId })),
      })
    }

    // One activity per contact that actually changed
    const changedContactIds = [...toMove.map(e => e.contactId), ...newIds]
    if (changedContactIds.length > 0) {
      await prisma.activity.createMany({
        data: changedContactIds.map(contactId => ({
          type: "PIPELINE_MOVED",
          title: `Movido a ${stage.name}`,
          contactId,
        })),
      })
    }

    const moved = toMove.length
    const added = newIds.length
    const unchanged = existing.length - moved
    return NextResponse.json({
      moved, added, unchanged,
      total: moved + added,
    })
  } catch (e) {
    console.error("Bulk move error:", e)
    return NextResponse.json({ error: "Failed to move leads" }, { status: 500 })
  }
}
