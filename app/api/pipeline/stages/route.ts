export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { pipelineId, name, color } = await req.json()
    if (!pipelineId || !name?.trim()) return NextResponse.json({ error: "pipelineId and name required" }, { status: 400 })

    const count = await prisma.pipelineStage.count({ where: { pipelineId } })
    const stage = await prisma.pipelineStage.create({
      data: { name, color: color || "#3B82F6", order: count, pipelineId },
    })
    return NextResponse.json(stage, { status: 201 })
  } catch (e) {
    console.error("Stage create error:", e)
    return NextResponse.json({ error: "Failed to create stage" }, { status: 500 })
  }
}
