export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// Upsert a contact's pipeline stage assignment
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { contactId, stageId, pipelineId } = await req.json()
    if (!contactId || !stageId) return NextResponse.json({ error: "contactId and stageId required" }, { status: 400 })

    // Find existing lead — scope to pipeline when known, otherwise get the most recent
    const existing = await prisma.pipelineLead.findFirst({
      where: pipelineId
        ? { contactId, stage: { pipelineId } }
        : { contactId },
      orderBy: { updatedAt: "desc" },
    })

    let lead
    if (existing) {
      lead = await prisma.pipelineLead.update({
        where: { id: existing.id },
        data: { stageId },
        include: { stage: true },
      })
    } else {
      lead = await prisma.pipelineLead.create({
        data: { contactId, stageId },
        include: { stage: true },
      })
    }

    // Log activity
    await prisma.activity.create({
      data: {
        type: "PIPELINE_MOVED",
        title: `Moved to ${lead.stage.name}`,
        contactId,
        userId: session.user?.id,
      },
    })

    return NextResponse.json(lead)
  } catch (e) {
    console.error("Pipeline lead upsert error:", e)
    return NextResponse.json({ error: "Failed to assign stage" }, { status: 500 })
  }
}
