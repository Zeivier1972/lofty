export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const templates = await prisma.emailTemplate.findMany({ orderBy: { createdAt: "desc" } })
  return NextResponse.json({ templates })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name, subject, body, category, isShared } = await req.json()
  if (!name?.trim() || !subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "name, subject, and body are required" }, { status: 400 })
  }

  const template = await prisma.emailTemplate.create({
    data: { name: name.trim(), subject: subject.trim(), body: body.trim(), category: category || null, isShared: !!isShared },
  })
  return NextResponse.json({ template }, { status: 201 })
}
