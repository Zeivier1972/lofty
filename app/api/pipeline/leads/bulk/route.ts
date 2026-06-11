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

// POST: add multiple contacts to a stage
// body: { contactIds: string[], stageId: string }
export async function POST(req: Request) {
  try {
    const { contactIds, stageId } = await req.json()
    if (!contactIds?.length || !stageId) {
      return NextResponse.json({ error: "contactIds and stageId required" }, { status: 400 })
    }

    const stage = await prisma.pipelineStage.findUnique({ where: { id: stageId } })
    if (!stage) return NextResponse.json({ error: "Stage not found" }, { status: 404 })

    // Upsert: skip contacts already in this pipeline
    const existing = await prisma.pipelineLead.findMany({
      where: { contactId: { in: contactIds }, stage: { pipelineId: stage.pipelineId } },
      select: { contactId: true },
    })
    const existingIds = new Set(existing.map(e => e.contactId))
    const newIds = contactIds.filter((id: string) => !existingIds.has(id))

    if (newIds.length > 0) {
      await prisma.pipelineLead.createMany({
        data: newIds.map((contactId: string) => ({ contactId, stageId })),
      })
      await prisma.activity.createMany({
        data: newIds.map((contactId: string) => ({
          type: "PIPELINE_MOVED",
          title: `Added to ${stage.name}`,
          contactId,
        })),
      })
    }

    return NextResponse.json({ added: newIds.length, skipped: existingIds.size })
  } catch (e) {
    console.error("Bulk add error:", e)
    return NextResponse.json({ error: "Failed to add leads" }, { status: 500 })
  }
}
