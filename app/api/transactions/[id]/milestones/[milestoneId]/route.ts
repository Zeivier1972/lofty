export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: Request, { params }: { params: { id: string; milestoneId: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const data: any = {}
  if (body.status !== undefined) {
    data.status = body.status
    data.completedDate = body.status === "COMPLETED" ? new Date() : null
  }
  if (body.name) data.name = body.name
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null
  if (body.notes !== undefined) data.notes = body.notes

  const milestone = await prisma.transactionMilestone.update({
    where: { id: params.milestoneId },
    data,
  })
  return NextResponse.json({ milestone })
}

export async function DELETE(_req: Request, { params }: { params: { id: string; milestoneId: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await prisma.transactionMilestone.delete({ where: { id: params.milestoneId } })
  return NextResponse.json({ success: true })
}
