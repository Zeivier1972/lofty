export const dynamic = "force-dynamic"
export const maxDuration = 120

// One-time enrollment of EXISTING Warm-stage leads into the "Warm → Hot"
// smart plan — as a QUEUED backlog, not an instant blast. The daily
// warm-plan-release cron then activates ~WARM_RELEASE_PER_DAY of them each
// morning, only when Catherine's open call-task queue is below the cap.
//
//   GET  /api/admin/enroll-warm-leads          → preview counts
//   GET  /api/admin/enroll-warm-leads?apply=1  → queue them up
//
// Excluded: leads already enrolled in the plan (any status), leads assigned
// to a partner realtor (active referral), and archived contacts.
// Session-protected — visit while logged in as the agent.

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const PLAN_NAME = "Warm → Hot: Camino a la Llamada"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const apply = new URL(req.url).searchParams.get("apply") === "1"
  const perDay = Number(process.env.WARM_RELEASE_PER_DAY || 30)

  const plan = await prisma.smartPlan.findFirst({ where: { name: PLAN_NAME }, select: { id: true } })
  if (!plan) {
    return NextResponse.json({ error: `Plan "${PLAN_NAME}" not found — has the latest deploy (db-migrate) run?` }, { status: 404 })
  }

  const warmStage = await prisma.pipelineStage.findFirst({
    where: { name: "Warm", pipeline: { isDefault: true } },
    select: { id: true },
  })
  if (!warmStage) return NextResponse.json({ error: "No 'Warm' stage found in the default pipeline" }, { status: 404 })

  // Leads currently in Warm — ordered by how long they've been waiting
  // (oldest first), so the longest-waiting leads are released first.
  const warmLeads = await prisma.pipelineLead.findMany({
    where: { stageId: warmStage.id, contact: { isArchived: false } },
    orderBy: { updatedAt: "asc" },
    select: {
      contactId: true,
      contact: {
        select: {
          id: true,
          leadReferrals: { where: { status: { notIn: ["CLOSED", "LOST", "RETURNED"] } }, select: { id: true }, take: 1 },
          enrollments: { where: { planId: plan.id }, select: { id: true }, take: 1 },
        },
      },
    },
  })

  const seen = new Set<string>()
  let alreadyEnrolled = 0
  let partnerAssigned = 0
  const eligible: string[] = []
  for (const l of warmLeads) {
    if (seen.has(l.contactId)) continue
    seen.add(l.contactId)
    if (l.contact.enrollments.length > 0) { alreadyEnrolled++; continue }
    if (l.contact.leadReferrals.length > 0) { partnerAssigned++; continue }
    eligible.push(l.contactId)
  }

  const days = Math.ceil(eligible.length / perDay)

  if (!apply) {
    return NextResponse.json({
      preview: true,
      inWarmStage: seen.size,
      alreadyEnrolled,
      assignedToPartner: partnerAssigned,
      eligibleToQueue: eligible.length,
      pace: `${perDay}/day → full rollout in ~${days} day${days !== 1 ? "s" : ""}`,
      message: `${eligible.length} Warm leads would be QUEUED (excluded: ${alreadyEnrolled} already enrolled, ${partnerAssigned} with a partner). The daily 10 AM release activates ~${perDay}/day, only when Catherine's open call tasks are under the cap. Add ?apply=1 to queue them.`,
    })
  }

  // Queue them with staggered enrolledAt (ms apart) so the release cron's
  // oldest-first ordering matches how long each lead has been in Warm.
  const base = Date.now()
  let queued = 0
  const CHUNK = 100
  for (let i = 0; i < eligible.length; i += CHUNK) {
    const chunk = eligible.slice(i, i + CHUNK)
    await prisma.smartPlanEnrollment.createMany({
      data: chunk.map((contactId, j) => ({
        planId: plan.id,
        contactId,
        status: "QUEUED",
        currentStep: 0,
        enrolledAt: new Date(base + i + j),
        nextStepAt: null,
      })),
    })
    queued += chunk.length
  }

  return NextResponse.json({
    applied: true,
    queued,
    pace: `${perDay}/day → ~${days} day${days !== 1 ? "s" : ""} to work through the queue`,
    message: `Queued ${queued} Warm leads. The first ~${perDay} activate at the next daily release (14:00 UTC / ~10 AM ET); texts go out within the hour after, and Catherine's call tasks + daily digest follow. Backpressure cap keeps her queue under ${process.env.WARM_TASK_CAP || 40} open tasks.`,
  })
}
