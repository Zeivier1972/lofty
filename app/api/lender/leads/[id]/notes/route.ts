export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getLoanOfficer } from "@/lib/lender-auth"

// POST — loan officer adds a note to a paid lead (visible to Catherine in the CRM)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const partner = await getLoanOfficer()
  if (!partner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: "Nota vacía" }, { status: 400 })

  const share = await prisma.leadShare.findUnique({ where: { id: params.id } })
  if (!share || share.loanOfficerId !== partner.id || share.status !== "PAID") {
    return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 })
  }

  const note = await prisma.leadShareNote.create({
    data: { leadShareId: share.id, author: "LO", content: content.trim() },
  })

  // Mirror into the CRM activity feed so Catherine sees the progress
  await prisma.activity.create({
    data: {
      type: "NOTE",
      title: `Nota de ${partner.name} (loan officer)`,
      description: content.trim(),
      contactId: share.contactId,
    },
  }).catch(() => {})

  return NextResponse.json({ note })
}
