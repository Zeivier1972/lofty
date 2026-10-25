export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { looksLikeSame } from "@/lib/message-dedupe"

/**
 * Read-only report: who has been sent the same message twice, and what in the
 * data is causing it.
 *
 * The send-time guard in lib/message-dedupe stops repeats from here on, but it
 * does not explain the ones already sent, and the two likeliest causes live in
 * the data rather than the code:
 *
 *  - the same contact enrolled more than once in one plan, so every step fires
 *    twice (nothing in the schema forbids it — SmartPlanEnrollment has no
 *    unique constraint on planId + contactId, and the guards before each
 *    create are findFirst-then-create, which two concurrent requests both pass)
 *  - two different plans carrying the same copy, so a contact in both gets it
 *    from each
 *
 * Writes nothing. Deciding what to do about a duplicate enrollment — pause it,
 * delete it, leave it — is a judgement call about a real person's campaign, so
 * it belongs to whoever reads this.
 */

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const days = Math.min(Number(searchParams.get("days") || 30), 180)
  const since = new Date(Date.now() - days * 24 * 3600 * 1000)

  // ── 1. Contacts enrolled more than once in the same plan ──────────────────
  const active = await prisma.smartPlanEnrollment.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, planId: true, contactId: true, currentStep: true, enrolledAt: true, nextStepAt: true },
  })
  type Enrollment = (typeof active)[number]
  const byKey = new Map<string, Enrollment[]>()
  for (const e of active) {
    const k = `${e.planId}|${e.contactId}`
    const list = byKey.get(k) ?? []
    list.push(e)
    byKey.set(k, list)
  }
  // Array.from rather than spreading the iterator: this project compiles below
  // the target where `[...map.entries()]` is allowed.
  const dupKeys = Array.from(byKey.entries()).filter(([, v]) => v.length > 1)

  const uniq = (xs: string[]) => Array.from(new Set(xs))
  const planIds = uniq(dupKeys.map(([k]) => k.split("|")[0]))
  const contactIds = uniq(dupKeys.map(([k]) => k.split("|")[1]))
  const [plans, contacts] = await Promise.all([
    prisma.smartPlan.findMany({ where: { id: { in: planIds } }, select: { id: true, name: true } }),
    prisma.contact.findMany({ where: { id: { in: contactIds } }, select: { id: true, firstName: true, lastName: true, phone: true } }),
  ])
  const planName = new Map(plans.map(p => [p.id, p.name]))
  const contactName = new Map(contacts.map(c => [c.id, { name: `${c.firstName} ${c.lastName || ""}`.trim(), phone: c.phone }]))

  const duplicateEnrollments = dupKeys.map(([k, list]) => {
    const [planId, contactId] = k.split("|")
    return {
      plan: planName.get(planId) ?? planId,
      contact: contactName.get(contactId)?.name ?? contactId,
      phone: contactName.get(contactId)?.phone ?? null,
      count: list.length,
      enrollmentIds: list.map((e: Enrollment) => e.id),
      steps: list.map((e: Enrollment) => e.currentStep),
      enrolledAt: list.map((e: Enrollment) => e.enrolledAt),
    }
  })

  // ── 2. Messages that actually went out twice ──────────────────────────────
  // Only contacts with enough recent outbound traffic to have a repeat are
  // scanned, so this stays cheap on a large history.
  const [sms, wa] = await Promise.all([
    prisma.sMSMessage.findMany({
      where: { direction: "OUTBOUND", createdAt: { gte: since }, status: { notIn: ["FAILED", "UNDELIVERED", "BLOCKED"] } },
      select: { body: true, createdAt: true, contactId: true, toNumber: true },
      orderBy: { createdAt: "desc" },
      take: 3000,
    }),
    prisma.whatsAppMessage.findMany({
      where: { direction: "OUTBOUND", createdAt: { gte: since }, status: { notIn: ["FAILED", "UNDELIVERED", "BLOCKED"] } },
      select: { body: true, createdAt: true, contactId: true, toNumber: true },
      orderBy: { createdAt: "desc" },
      take: 3000,
    }),
  ])

  type Row = { body: string; createdAt: Date; contactId: string | null; toNumber: string; channel: "SMS" | "WHATSAPP" }
  const all: Row[] = [
    ...sms.map(m => ({ ...m, channel: "SMS" as const })),
    ...wa.map(m => ({ ...m, channel: "WHATSAPP" as const })),
  ]

  // Group by recipient — the phone number, since duplicate contact rows for one
  // person are themselves a way repeats happen.
  const byRecipient = new Map<string, Row[]>()
  for (const m of all) {
    const key = (m.toNumber || "").replace(/\D/g, "").slice(-10) || m.contactId || "unknown"
    const list = byRecipient.get(key) ?? []
    list.push(m)
    byRecipient.set(key, list)
  }

  const repeated: { phone: string; channelPair: string; sentAt: Date[]; preview: string }[] = []
  for (const [phone, list] of Array.from(byRecipient.entries())) {
    if (list.length < 2) continue
    const seen: Row[] = []
    for (const m of list) {
      const prior = seen.find(x => looksLikeSame(x.body, m.body))
      if (prior) {
        repeated.push({
          phone,
          channelPair: prior.channel === m.channel ? `${m.channel} x2` : `${prior.channel} + ${m.channel}`,
          sentAt: [m.createdAt, prior.createdAt],
          preview: m.body.slice(0, 110),
        })
      } else {
        seen.push(m)
      }
    }
  }

  return NextResponse.json({
    windowDays: days,
    duplicateEnrollments: {
      count: duplicateEnrollments.length,
      note: "Un contacto inscrito más de una vez en el mismo plan recibe cada paso una vez por inscripción.",
      rows: duplicateEnrollments,
    },
    repeatedMessages: {
      count: repeated.length,
      note: "Mensajes ya enviados dos veces al mismo número. El guard nuevo evita los próximos; estos son históricos.",
      rows: repeated.slice(0, 100),
    },
    scanned: { sms: sms.length, whatsapp: wa.length },
  })
}
