export const dynamic = "force-dynamic"
export const maxDuration = 120

// Daily pacing for the "Warm → Hot" smart plan rollout. Three jobs:
//
//  1. EXPIRE (Layer 2): plan-generated call tasks older than 3 days are
//     cancelled — they're a call list, not a debt. The sequence keeps
//     nurturing the lead regardless, so nothing is lost.
//  2. RELEASE (Layer 1, backpressure): activate the next batch of QUEUED
//     enrollments ONLY if Catherine's open Warm-call task queue is below the
//     cap. She misses days → nothing new is released → no pile-up, ever.
//  3. DIGEST (Layer 3): one task per day — "today's Warm call list" — that
//     replaces yesterday's. A missed day evaporates instead of accumulating.
//
// Tunables (Railway env): WARM_RELEASE_PER_DAY (default 30),
//                         WARM_TASK_CAP (default 40)

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const PLAN_NAME = "Warm → Hot: Camino a la Llamada"
// Marker baked into the plan's TASK step titles — how we recognize our tasks
const CALL_TASK_MARKER = "Warm sin cita"
const DIGEST_MARKER = "Lista de llamadas Warm"

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET || process.env.MLS_SYNC_SECRET
  if (!secret) return true
  const header = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "")
  const param = new URL(req.url).searchParams.get("secret")
  return header === secret || param === secret
}

async function run(): Promise<Response> {
  const log: string[] = []
  const now = new Date()
  const BATCH = Number(process.env.WARM_RELEASE_PER_DAY || 30)
  const CAP = Number(process.env.WARM_TASK_CAP || 40)

  const plan = await prisma.smartPlan.findFirst({ where: { name: PLAN_NAME }, select: { id: true } })
  if (!plan) return NextResponse.json({ ok: false, error: `Plan "${PLAN_NAME}" not found` }, { status: 404 })

  // ── 1. Expire stale call tasks (3+ days old) and yesterday's digest ────────
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400000)
  const expired = await prisma.task.updateMany({
    where: { status: "PENDING", title: { contains: CALL_TASK_MARKER }, createdAt: { lt: threeDaysAgo } },
    data: { status: "CANCELLED" },
  })
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const oldDigests = await prisma.task.updateMany({
    where: { status: "PENDING", title: { contains: DIGEST_MARKER }, createdAt: { lt: todayStart } },
    data: { status: "CANCELLED" },
  })
  log.push(`Expired ${expired.count} stale call tasks (>3d) and ${oldDigests.count} old digest(s)`)

  // ── 2. Backpressure check, then release the next batch ─────────────────────
  const openTasks = await prisma.task.count({
    where: { status: "PENDING", title: { contains: CALL_TASK_MARKER } },
  })
  let released = 0
  let skippedNotWarm = 0

  if (openTasks >= CAP) {
    log.push(`Backpressure: ${openTasks} open call tasks ≥ cap ${CAP} — no release today. Queue resumes when tasks are worked or expire.`)
  } else {
    // Warm stage id — released leads must STILL be in Warm (skip anyone
    // Catherine already moved to Hot/Closed/etc. while they were queued)
    const warmStage = await prisma.pipelineStage.findFirst({
      where: { name: "Warm", pipeline: { isDefault: true } },
      select: { id: true },
    })

    const queued = await prisma.smartPlanEnrollment.findMany({
      where: { planId: plan.id, status: "QUEUED" },
      orderBy: { enrolledAt: "asc" }, // oldest engagement first
      take: BATCH * 2, // headroom for skips
      select: { id: true, contactId: true },
    })

    const toActivate: string[] = []
    const toCancel: string[] = []
    for (const e of queued) {
      if (toActivate.length >= BATCH) break
      const stillWarm = warmStage
        ? await prisma.pipelineLead.findFirst({
            where: { contactId: e.contactId, stageId: warmStage.id },
            select: { id: true },
          })
        : null
      if (warmStage && !stillWarm) { toCancel.push(e.id); skippedNotWarm++; continue }
      toActivate.push(e.id)
    }

    if (toCancel.length) {
      await prisma.smartPlanEnrollment.updateMany({
        where: { id: { in: toCancel } },
        data: { status: "CANCELLED" },
      })
    }
    if (toActivate.length) {
      await prisma.smartPlanEnrollment.updateMany({
        where: { id: { in: toActivate } },
        data: { status: "ACTIVE", nextStepAt: now },
      })
      released = toActivate.length
    }
    const remaining = await prisma.smartPlanEnrollment.count({ where: { planId: plan.id, status: "QUEUED" } })
    log.push(`Released ${released} enrollment(s) (open tasks ${openTasks} < cap ${CAP}); skipped ${skippedNotWarm} no longer in Warm; ${remaining} still queued.`)
  }

  // ── 3. Today's digest — one task listing everyone worth calling today ──────
  const openCallTasks = await prisma.task.findMany({
    where: { status: "PENDING", title: { contains: CALL_TASK_MARKER } },
    select: { contactId: true },
  })
  const contactIds = Array.from(new Set(openCallTasks.map((t: { contactId: string | null }) => t.contactId).filter(Boolean))) as string[]
  if (contactIds.length > 0) {
    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds } },
      select: { firstName: true, lastName: true, phone: true },
      take: 15,
    })
    const lines = contacts.map((c: { firstName: string; lastName: string | null; phone: string | null }) =>
      `• ${c.firstName} ${c.lastName || ""}`.trim() + (c.phone ? ` — ${c.phone}` : ""))
    const more = contactIds.length > contacts.length ? `\n…y ${contactIds.length - contacts.length} más.` : ""
    const user = await prisma.user.findFirst({ select: { id: true } })
    const due = new Date(now); due.setHours(20, 0, 0, 0)
    await prisma.task.create({
      data: {
        title: `📞 ${DIGEST_MARKER} de hoy — ${contactIds.length} lead${contactIds.length !== 1 ? "s" : ""}`,
        description: `Leads Warm esperando tu llamada (abre el Power Dialer y marca la lista):\n${lines.join("\n")}${more}`,
        type: "CALL",
        priority: "HIGH",
        status: "PENDING",
        assignedToId: user?.id,
        dueDate: due,
      },
    })
    log.push(`Digest created: ${contactIds.length} leads on today's call list`)
  } else {
    log.push("No open call tasks — no digest needed today")
  }

  return NextResponse.json({ ok: true, released, expired: expired.count, openTasksBefore: openTasks, cap: CAP, batch: BATCH, log })
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return run()
}

// Railway's cron calls POST — support both (see the match-alerts 405 lesson)
export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return run()
}
