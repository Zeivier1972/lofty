export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { name } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 })

    const pipeline = await prisma.pipeline.create({
      data: { name: name.trim(), isDefault: false },
      include: { stages: { orderBy: { order: "asc" } } },
    })
    return NextResponse.json(pipeline, { status: 201 })
  } catch (e) {
    console.error("Pipeline create error:", e)
    return NextResponse.json({ error: "Failed to create pipeline" }, { status: 500 })
  }
}
