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

  const existing = await prisma.smartPlan.findFirst({ where: { name: NEW_NAME } })
  if (existing) {
    await prisma.smartPlan.update({
      where: { id: existing.id },
      data: { trigger: `CONTACT_TAGGED:${tag.id}`, isActive: true },
    })
    return NextResponse.json({ ok: true, created: false, planId: existing.id, name: NEW_NAME, message: "Ya existía; trigger reactivado." })
  }

  const plan = await prisma.smartPlan.create({
    data: {
      name: NEW_NAME,
      description: `Adaptado de "${SRC_NAME}" para inversionistas de Costa Rica. Se activa con el tag "${TAG_NAME}". Revisa los mensajes y ajusta lo que necesites.`,
      trigger: `CONTACT_TAGGED:${tag.id}`,
      isActive: true,
      userId: (session.user?.id as string) || undefined,
      steps: {
        create: src.steps.map(s => ({
          order: s.order,
          type: s.type,
          delay: s.delay,
          subject: adapt(s.subject),
          content: adapt(s.content),
          taskTitle: adapt(s.taskTitle),
          taskType: s.taskType,
          isActive: s.isActive,
        })),
      },
    },
  })

  return NextResponse.json({ ok: true, created: true, planId: plan.id, name: NEW_NAME, steps: src.steps.length })
}
