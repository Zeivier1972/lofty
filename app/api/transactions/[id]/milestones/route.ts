export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name, dueDate, order } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 })

  const milestone = await prisma.transactionMilestone.create({
    data: {
      transactionId: params.id,
      name: name.trim(),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      order: order ?? 99,
    },
  })
  return NextResponse.json({ milestone })
}
