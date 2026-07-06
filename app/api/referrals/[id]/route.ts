export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const STATUSES = ["SENT", "CONTACTED", "SHOWING", "UNDER_CONTRACT", "CLOSED", "LOST", "RETURNED"]

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { status, notes } = await req.json()
  if (status && !STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  const referral = await prisma.leadReferral.update({
    where: { id: params.id },
    data: {
      ...(status && { status }),
      ...(notes !== undefined && { notes: notes?.trim() || null }),
    },
    include: { partner: { select: { name: true } }, contact: { select: { id: true } } },
  })

  // Track status changes on the contact timeline
  if (status) {
    await prisma.activity.create({
      data: {
        contactId: referral.contact.id,
        userId: session.user?.id,
        type: "LEAD_REFERRED",
        title: `Referral to ${referral.partner.name}: ${status.replace(/_/g, " ").toLowerCase()}`,
      },
    }).catch(() => {})
  }

  return NextResponse.json(referral)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await prisma.leadReferral.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
