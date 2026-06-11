export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
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
  try {
    await prisma.pipelineLead.deleteMany({ where: { stageId: params.id } })
    await prisma.pipelineStage.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: "Failed to delete stage" }, { status: 500 })
  }
}
