export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const TAG_NAME = "Inversionista Costa Rica"
const PLAN_NAME = "Inversionista Costa Rica — Nurture"
const LANDING = "https://www.catherinegomezrealtor.com/guias/inversionista-costa-rica"
const BOOK = "https://www.catherinegomezrealtor.com/book"

// delay is in DAYS before the step fires. WHATSAPP falls back to SMS if there's
// no open WhatsApp session. {first_name}/{agent_name}/{agent_phone} are filled
// by the smart-plan cron.
const STEPS = [
  {
    type: "EMAIL", delay: 0,
    subject: "{first_name}, tu Kit de Inversión — One Twenty Brickell 🏙️",
    content: `<p>¡Hola {first_name}!</p>
<p>Gracias por tu interés en invertir en Miami desde Costa Rica. Aquí tienes toda la información de <strong>One Twenty Brickell</strong> — pre-construcción en el corazón financiero de Miami, con plan de pagos y financiamiento para extranjeros.</p>
<p><a href="${LANDING}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Ver la información completa →</a></p>
<p>Te contactaré personalmente para mostrarte los números y el plan de pagos. Si prefieres, <a href="${BOOK}">agenda una llamada aquí</a>.</p>
<p>Un abrazo,<br/>{agent_name}</p>`,
  },
  {
    type: "WHATSAPP", delay: 0,
    content: `Hola {first_name} 👋 Soy {agent_name}. Vi que te interesa invertir en Miami desde Costa Rica (One Twenty Brickell). ¿Te muestro los números y el plan de pagos? Agenda aquí: ${BOOK}`,
  },
  {
    type: "EMAIL", delay: 2,
    subject: "Por qué los ticos están invirtiendo en Brickell 🇨🇷🏙️",
    content: `<p>Hola {first_name},</p>
<p>Estas son las 3 razones por las que inversionistas de Costa Rica están comprando en Miami:</p>
<ul>
<li><strong>Dólares:</strong> tu capital protegido en USD, lejos de la volatilidad local.</li>
<li><strong>Plusvalía:</strong> Brickell se ha apreciado año tras año; comprar en pre-construcción maximiza la ganancia.</li>
<li><strong>Financiamiento para extranjeros:</strong> no necesitas ser residente — bancos prestan con 30–40% de enganche.</li>
</ul>
<p><a href="${LANDING}">Ver One Twenty Brickell →</a> · <a href="${BOOK}">Agendar llamada →</a></p>
<p>{agent_name}</p>`,
  },
  {
    type: "SMS", delay: 3,
    content: `Hola {first_name}, soy {agent_name}. ¿Pudiste ver la info de One Twenty Brickell? Con gusto te explico el financiamiento para extranjeros (solo 30–40% de enganche). ¿Cuándo te llamo?`,
  },
  {
    type: "TASK", delay: 5, taskType: "CALL",
    taskTitle: "📞 Llamar a {first_name} — Inversionista Costa Rica",
    content: "Lead de campaña Costa Rica (One Twenty Brickell). Explicar números, plan de pagos y financiamiento para extranjeros. Agendar próxima llamada o reserva.",
  },
  {
    type: "EMAIL", delay: 7,
    subject: "{first_name}, las mejores unidades se están reservando",
    content: `<p>Hola {first_name},</p>
<p>Las unidades con mejor vista y precio de One Twenty Brickell se reservan primero. No quiero que pierdas la oportunidad de entrar en pre-construcción con el mejor precio.</p>
<p>¿Hablamos esta semana? <a href="${BOOK}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Agenda tu llamada →</a></p>
<p>Estoy para ayudarte,<br/>{agent_name}</p>`,
  },
] as const

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // 1. Ensure the tag exists (same name FB utm_campaign produces).
  const tag = await prisma.tag.upsert({
    where: { name: TAG_NAME },
    update: {},
    create: { name: TAG_NAME, color: "#10B981" },
  })

  // 2. Idempotent: reuse the plan if it already exists.
  const existing = await prisma.smartPlan.findFirst({ where: { name: PLAN_NAME } })
  if (existing) {
    // Keep the trigger pointed at the current tag id, and make sure it's active.
    await prisma.smartPlan.update({
      where: { id: existing.id },
      data: { trigger: `CONTACT_TAGGED:${tag.id}`, isActive: true },
    })
    return NextResponse.json({ ok: true, created: false, planId: existing.id, tagId: tag.id, message: "El Smart Plan ya existía; trigger actualizado." })
  }

  // 3. Create the plan with all steps.
  const plan = await prisma.smartPlan.create({
    data: {
      name: PLAN_NAME,
      description: "Nurture automático para inversionistas de Costa Rica (One Twenty Brickell). Se activa con el tag \"Inversionista Costa Rica\".",
      trigger: `CONTACT_TAGGED:${tag.id}`,
      isActive: true,
      userId: (session.user?.id as string) || undefined,
      steps: {
        create: STEPS.map((s, i) => ({
          order: i,
          type: s.type,
          delay: s.delay,
          subject: "subject" in s ? s.subject : null,
          content: "content" in s ? s.content : null,
          taskTitle: "taskTitle" in s ? s.taskTitle : null,
          taskType: "taskType" in s ? s.taskType : null,
        })),
      },
    },
  })

  return NextResponse.json({ ok: true, created: true, planId: plan.id, tagId: tag.id, steps: STEPS.length })
}
