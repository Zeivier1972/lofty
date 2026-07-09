export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  try {
    const { pipelineId, name, color } = await req.json()
    if (!pipelineId || !name?.trim()) return NextResponse.json({ error: "pipelineId and name required" }, { status: 400 })

    // Guard against a stale/invalid pipelineId from an old open tab
    const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId }, select: { id: true } })
    if (!pipeline) return NextResponse.json({ error: "Pipeline not found — refresh the page and try again" }, { status: 404 })

    // Place after the current max order (count collides after deletes)
    const maxOrder = await prisma.pipelineStage.aggregate({
      where: { pipelineId },
      _max: { order: true },
    })
    const stage = await prisma.pipelineStage.create({
      data: { name: name.trim(), color: color || "#3B82F6", order: (maxOrder._max.order ?? -1) + 1, pipelineId },
    })
    return NextResponse.json(stage, { status: 201 })
  } catch (e: any) {
    console.error("Stage create error:", e)
    // Surface the real reason so the UI toast is actionable instead of generic
    return NextResponse.json({ error: `Failed to create stage: ${e?.message?.slice(0, 200) || "unknown error"}` }, { status: 500 })
  }
}
