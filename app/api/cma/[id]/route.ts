export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(req: Request, { params }: { params: { id: string } }) {
  // Try by id first, then shareToken (public access)
  const report = await prisma.cMAReport.findFirst({
    where: { OR: [{ id: params.id }, { shareToken: params.id }] },
  })
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!report.isPublic) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Track view
  if (!report.viewedAt) {
    await prisma.cMAReport.update({ where: { id: report.id }, data: { viewedAt: new Date() } })
  }

  return NextResponse.json({ ...report, comps: JSON.parse(report.comps) })
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { comps, ...rest } = body

  const report = await prisma.cMAReport.update({
    where: { id: params.id },
    data: { ...rest, ...(comps !== undefined && { comps: JSON.stringify(comps) }) },
  })
  return NextResponse.json(report)
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await prisma.cMAReport.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
