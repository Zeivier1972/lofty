export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// Clone the proven Colombia investor plan into a Costa Rica version, adapting the
// copy. Runs in the agent's authenticated dashboard session (button on the
// Smart Plans page).
const SRC_NAME = "Invierte en Florida desde Colombia"
const NEW_NAME = "Invierte en Florida desde Costa Rica"
const TAG_NAME = "Inversionista Costa Rica"
const LANDING = "https://www.catherinegomezrealtor.com/guias/inversionista-costa-rica"

// Localize Colombia → Costa Rica in step copy.
function adapt(text: string | null): string | null {
  if (!text) return text
  let t = text
  t = t.replace(/Colombia/g, "Costa Rica").replace(/colombia/g, "costa rica")
  t = t.replace(/Bogot[áa]/gi, "Costa Rica")
  t = t.replace(/colombianas?/gi, "costarricenses").replace(/colombianos?/gi, "costarricenses")
  t = t.replace(/colombian[oa]/gi, "costarricense")
  t = t.replace(/🇨🇴/g, "🇨🇷")
  // Point any Colombia landing links at the Costa Rica page.
  t = t.replace(/https?:\/\/[^\s"')]*inversionista-bogota[^\s"')]*/gi, LANDING)
  return t
}

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const src = await prisma.smartPlan.findFirst({
    where: { name: SRC_NAME },
    include: { steps: { orderBy: { order: "asc" } } },
  })
  if (!src) return NextResponse.json({ error: `No encontré el plan "${SRC_NAME}"` }, { status: 404 })

  const tag = await prisma.tag.upsert({
    where: { name: TAG_NAME },
    update: {},
    create: { name: TAG_NAME, color: "#10B981" },
  })

  const stepData = src.steps.map(s => ({
    order: s.order,
    type: s.type,
    delay: s.delay,
    subject: adapt(s.subject),
    content: adapt(s.content),
    taskTitle: adapt(s.taskTitle),
    taskType: s.taskType,
    isActive: s.isActive,
  }))

  const existing = await prisma.smartPlan.findFirst({ where: { name: NEW_NAME } })
  let planId: string
  let created: boolean
  if (existing) {
    // Regenerate the steps from the (adapted) source so re-running refreshes the
    // copy — e.g. to strip any Colombia wording so Costa Rica leads aren't told
    // they're Colombian.
    await prisma.smartPlanStep.deleteMany({ where: { planId: existing.id } })
    await prisma.smartPlan.update({
      where: { id: existing.id },
      data: { trigger: `CONTACT_TAGGED:${tag.id}`, isActive: true, steps: { create: stepData } },
    })
    planId = existing.id
    created = false
  } else {
    const plan = await prisma.smartPlan.create({
      data: {
        name: NEW_NAME,
        description: `Adaptado de "${SRC_NAME}" para inversionistas de Costa Rica. Se activa con el tag "${TAG_NAME}". Revisa los mensajes y ajusta lo que necesites.`,
        trigger: `CONTACT_TAGGED:${tag.id}`,
        isActive: true,
        userId: (session.user?.id as string) || undefined,
        steps: { create: stepData },
      },
    })
    planId = plan.id
    created = true
  }

  // Backfill: auto-enroll only fires the moment a tag is applied, so leads tagged
  // BEFORE this plan existed were never enrolled. Enroll everyone currently
  // carrying the tag who isn't already active in this plan.
  const tagged = await prisma.contactTag.findMany({ where: { tagId: tag.id }, select: { contactId: true } })
  const firstDelay = stepData.find(s => s.order === 0)?.delay ?? 0
  const nextStepAt = new Date(Date.now() + firstDelay * 86400000)
  let enrolled = 0
  for (const { contactId } of tagged) {
    const already = await prisma.smartPlanEnrollment.findFirst({ where: { contactId, planId, status: "ACTIVE" } })
    if (!already) {
      await prisma.smartPlanEnrollment.create({ data: { contactId, planId, status: "ACTIVE", currentStep: 0, nextStepAt } })
      enrolled++
    }
  }

  return NextResponse.json({
    ok: true, created, planId, name: NEW_NAME, steps: stepData.length,
    enrolled, taggedTotal: tagged.length,
    message: `${created ? "Creado" : "Actualizado"} · ${enrolled} lead(s) inscritos${tagged.length > enrolled ? ` (${tagged.length - enrolled} ya estaban)` : ""}.`,
  })
}
