export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name, subject, body, category, isShared } = await req.json()
  const template = await prisma.emailTemplate.update({
    where: { id: params.id },
    data: {
      ...(name    ? { name:     name.trim()    } : {}),
      ...(subject ? { subject:  subject.trim() } : {}),
      ...(body    ? { body:     body.trim()    } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(isShared !== undefined ? { isShared } : {}),
    },
  })
  return NextResponse.json({ template })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await prisma.emailTemplate.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
