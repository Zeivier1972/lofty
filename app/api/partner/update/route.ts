export const dynamic = "force-dynamic"

// Partner portal actions: update referral status, add notes, log calls.
// Everything the partner does is mirrored to the contact's activity timeline
// so the referring agent sees progress in the CRM.

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getPartnerSession } from "@/lib/partner-auth"

const STATUSES = ["SENT", "CONTACTED", "SHOWING", "UNDER_CONTRACT", "CLOSED", "LOST", "RETURNED"]
const KINDS = ["NOTE", "CALL", "STATUS"]

export async function POST(req: Request) {
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { referralId, status, note, kind } = await req.json()
  if (!referralId) return NextResponse.json({ error: "referralId required" }, { status: 400 })

  const referral = await prisma.leadReferral.findUnique({
    where: { id: referralId },
    include: { partner: { select: { id: true, name: true } }, contact: { select: { id: true } } },
  })
  if (!referral || referral.partner.id !== session.partnerId) {
    return NextResponse.json({ error: "Referral not found" }, { status: 404 })
  }

  const updates: any[] = []

  if (status && STATUSES.includes(status) && status !== referral.status) {
    await prisma.leadReferral.update({ where: { id: referralId }, data: { status } })
    const statusUpdate = await prisma.referralUpdate.create({
      data: {
        referralId,
        author: "PARTNER",
        kind: "STATUS",
        body: `Status changed to ${status.replace(/_/g, " ")}`,
      },
    })
    updates.push(statusUpdate)
    await prisma.activity.create({
      data: {
        contactId: referral.contact.id,
        type: "LEAD_REFERRED",
        title: `${referral.partner.name} updated referral: ${status.replace(/_/g, " ").toLowerCase()}`,
      },
    }).catch(() => {})
  }

  if (note?.trim()) {
    const noteKind = KINDS.includes(kind) ? kind : "NOTE"
    const noteUpdate = await prisma.referralUpdate.create({
      data: { referralId, author: "PARTNER", kind: noteKind, body: note.trim() },
    })
    updates.push(noteUpdate)
    await prisma.activity.create({
      data: {
        contactId: referral.contact.id,
        type: noteKind === "CALL" ? "CALL_MADE" : "NOTE_ADDED",
        title: noteKind === "CALL"
          ? `${referral.partner.name} logged a call`
          : `${referral.partner.name} added a note`,
        description: note.trim().slice(0, 500),
      },
    }).catch(() => {})
  }

  // Touch updatedAt even if only a note was added
  await prisma.leadReferral.update({ where: { id: referralId }, data: { updatedAt: new Date() } }).catch(() => {})

  return NextResponse.json({ ok: true, updates })
}
