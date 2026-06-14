export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const transaction = await prisma.transaction.findUnique({
    where: { id: params.id },
    include: {
      milestones: { orderBy: { order: "asc" } },
      documents: { orderBy: { uploadedAt: "desc" } },
      contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
    },
  })
  if (!transaction) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ transaction })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const allowed = ["status", "salePrice", "listPrice", "closeDate", "contractDate", "notes", "title", "address"]
  const data: any = {}
  for (const key of allowed) {
    if (body[key] !== undefined) {
      data[key] = key.includes("Date") && body[key] ? new Date(body[key]) : body[key]
    }
  }

  const transaction = await prisma.transaction.update({ where: { id: params.id }, data })
  return NextResponse.json({ transaction })
}
