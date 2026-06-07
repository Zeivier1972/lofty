export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { name, color } = await req.json()
    const stage = await prisma.pipelineStage.update({
      where: { id: params.id },
      data: { ...(name && { name }), ...(color && { color }) },
    })
    return NextResponse.json(stage)
  } catch (e) {
    return NextResponse.json({ error: "Failed to update stage" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    // Delete leads in this stage first (no cascade defined on PipelineLead → PipelineStage)
    await prisma.pipelineLead.deleteMany({ where: { stageId: params.id } })
    await prisma.pipelineStage.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: "Failed to delete stage" }, { status: 500 })
  }
}
