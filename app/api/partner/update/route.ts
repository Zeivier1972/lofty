export const dynamic = "force-dynamic"

// Partner portal actions: update referral status, add notes, log calls.
// Everything the partner does is mirrored to the contact's activity timeline
// so the referring agent sees progress in the CRM.

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getPartnerSession } from "@/lib/partner-auth"

const STATUSES = ["SENT", "CONTACTED", "SHOWING", "UNDER_CONTRACT", "CLOSED", "LOST", "RETURNED"]
const KINDS = ["NOTE", "CALL", "STATUS"]

// CRM pipeline stages a partner may move their leads into — these drive the
// system's automated follow-up texts/emails for the lead.
const ALLOWED_CRM_STAGES = ["contacted 1", "contacted 2", "contacted 3", "contacted 4", "drip campaign"]

export async function POST(req: Request) {
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { referralId, status, note, kind, crmStageId } = await req.json()
  if (!referralId) return NextResponse.json({ error: "referralId required" }, { status: 400 })

  const referral = await prisma.leadReferral.findUnique({
    where: { id: referralId },
    include: { partner: { select: { id: true, name: true } }, contact: { select: { id: true } } },
  })
  if (!referral || referral.partner.id !== session.partnerId) {
    return NextResponse.json({ error: "Referral not found" }, { status: 404 })
  }

  const updates: any[] = []

  // Move the lead's CRM pipeline stage (Contacted 1-4 / Drip Campaign) so the
  // system's automation keeps sending the lead the right messages. Smart Plan
  // enrollments are untouched and continue running.
  if (crmStageId) {
    const stage = await prisma.pipelineStage.findUnique({
      where: { id: crmStageId },
      select: { id: true, name: true },
    })
    if (!stage || !ALLOWED_CRM_STAGES.includes(stage.name.toLowerCase().trim())) {
      return NextResponse.json({ error: "Stage not allowed" }, { status: 400 })
    }
    const existingLead = await prisma.pipelineLead.findFirst({
      where: { contactId: referral.contact.id },
      orderBy: { updatedAt: "desc" },
    })
    if (existingLead) {
      await prisma.pipelineLead.update({ where: { id: existingLead.id }, data: { stageId: stage.id } })
    } else {
      await prisma.pipelineLead.create({ data: { contactId: referral.contact.id, stageId: stage.id } })
    }
    const stageUpdate = await prisma.referralUpdate.create({
      data: { referralId, author: "PARTNER", kind: "STATUS", body: `CRM stage → ${stage.name}` },
    })
    updates.push(stageUpdate)
    await prisma.activity.create({
      data: {
        contactId: referral.contact.id,
        type: "PIPELINE_MOVED",
        title: `${referral.partner.name} moved lead to ${stage.name}`,
      },
    }).catch(() => {})
  }

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
