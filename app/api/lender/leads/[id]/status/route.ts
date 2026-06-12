export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getLoanOfficer } from "@/lib/lender-auth"

const VALID_STATUSES = ["NEW", "CONTACTED", "PRE_APPROVED", "DOCS_REQUESTED", "CLOSED", "LOST"]

// PATCH — loan officer updates their progress status on a paid lead
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const partner = await getLoanOfficer()
  if (!partner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { loStatus } = await req.json()
  if (!VALID_STATUSES.includes(loStatus)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 })
  }

  const share = await prisma.leadShare.findUnique({ where: { id: params.id } })
  if (!share || share.loanOfficerId !== partner.id || share.status !== "PAID") {
    return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 })
  }

  await prisma.leadShare.update({ where: { id: share.id }, data: { loStatus } })

  await prisma.activity.create({
    data: {
      type: "NOTE",
      title: `${partner.name} actualizó el estado del préstamo`,
      description: `Estado: ${loStatus.replace(/_/g, " ")}`,
      contactId: share.contactId,
    },
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
