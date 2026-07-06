export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name, email, phone, brokerage, feePct, notes, isActive } = await req.json()
  const partner = await prisma.referralPartner.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(email !== undefined && { email: email?.trim() || null }),
      ...(phone !== undefined && { phone: phone?.trim() || null }),
      ...(brokerage !== undefined && { brokerage: brokerage?.trim() || null }),
      ...(feePct !== undefined && { feePct: typeof feePct === "number" ? feePct : null }),
      ...(notes !== undefined && { notes: notes?.trim() || null }),
      ...(isActive !== undefined && { isActive: !!isActive }),
    },
  })
  return NextResponse.json(partner)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await prisma.referralPartner.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
