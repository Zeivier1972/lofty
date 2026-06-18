/**
 * Automated lead nurturing flow.
 *
 * Stage progression on no-answer calls:
 *   New / none → Contacted 1 → Contacted 2 → Contacted 3 → Contacted 4 → Drip Campaign
 *
 * Sofia (AI) auto-retries all 4 calls — 24 h apart, during business hours.
 * Catherine only gets involved when a lead becomes Warm (engagement detected).
 */

import { prisma } from "@/lib/prisma"
import { sendSMS } from "@/lib/sms"
import { sendEmail } from "@/lib/email"

const CONTACTED_STAGES = ["Contacted 1", "Contacted 2", "Contacted 3", "Contacted 4"]
const NO_ANSWER_REASONS = [
  "customer-did-not-answer",
  "voicemail",
  "customer-busy",
  "no-answer",
  "silence-timed-out",
  "pipeline-error",
]

const RETRY_DELAY_HOURS = 24

async function getPipeline() {
  return prisma.pipeline.findFirst({
    where: { isDefault: true },
    include: { stages: { orderBy: { order: "asc" } } },
  })
}

async function getCurrentStage(contactId: string) {
  const lead = await prisma.pipelineLead.findFirst({
    where: { contactId },
    include: { stage: true },
    orderBy: { updatedAt: "desc" },
  })
  return lead?.stage ?? null
}

async function getPipelineIdForStage(stageId: string): Promise<string | null> {
  const stage = await prisma.pipelineStage.findUnique({ where: { id: stageId }, select: { pipelineId: true } })
  return stage?.pipelineId ?? null
}

async function checkPipelineStageSmartPlans(contactId: string, stageName: string) {
  const plans = await prisma.smartPlan.findMany({
    where: { isActive: true, trigger: `PIPELINE_STAGE:${stageName}` },
    include: { steps: { where: { order: 0 }, take: 1 } },
  })
  for (const plan of plans) {
    const already = await prisma.smartPlanEnrollment.findFirst({
      where: { contactId, planId: plan.id, status: "ACTIVE" },
    })
    if (!already) {
      const delay = plan.steps[0]?.delay ?? 0
      const nextStepAt = new Date(Date.now() + delay * 86400000)
      await prisma.smartPlanEnrollment.create({
        data: { contactId, planId: plan.id, status: "ACTIVE", currentStep: 0, nextStepAt },
      })
    }
  }
}

async function moveToStage(contactId: string, stageId: string, stageName: string) {
  // Scope to the pipeline this stage belongs to so we never update a stale duplicate record
  const pipelineId = await getPipelineIdForStage(stageId)
  const existing = await prisma.pipelineLead.findFirst({
    where: {
      contactId,
      ...(pipelineId ? { stage: { pipelineId } } : {}),
    },
    orderBy: { updatedAt: "desc" },
  })
  if (existing) {
    await prisma.pipelineLead.update({ where: { id: existing.id }, data: { stageId } })
  } else {
    await prisma.pipelineLead.create({ data: { contactId, stageId } })
  }
  await prisma.activity.create({
    data: { type: "PIPELINE_MOVED", title: `Movido a ${stageName} (automático)`, contactId },
  })
  checkPipelineStageSmartPlans(contactId, stageName).catch(() => {})
}

async function createCatherineTask(contactId: string, title: string, description?: string) {
  const user = await prisma.user.findFirst({ select: { id: true } })
  const due = new Date()
  due.setHours(due.getHours() + 2)
  await prisma.task.create({
    data: {
      title,
      description,
      contactId,
      assignedToId: user?.id,
      dueDate: due,
      priority: "HIGH",
      status: "PENDING",
      type: "CALL",
    },
  })
}

async function scheduleRetryCall(contactId: string, attempt: number) {
  const scheduledAt = new Date()
  scheduledAt.setHours(scheduledAt.getHours() + RETRY_DELAY_HOURS)
  await prisma.scheduledCall.create({
    data: { contactId, scheduledAt, attempt, status: "PENDING" },
  })
}

async function sendOutreachMessages(contact: any, stageName: string, config: any) {
  const name = contact.firstName
  const campaign = contact.buyerLocation || contact.buyerPropertyType || "propiedades en Miami"
  const calendly = config?.calendlyUrl || `${process.env.NEXT_PUBLIC_APP_URL}/book`
  const phone = contact.phone

  const smsBody = `Hola ${name}! Intentamos contactarte porque mostraste interés en ${campaign}. Catherine Gomez está lista para ayudarte a encontrar tu hogar ideal. ¿Tienes un momento? Llámanos al ${config?.realtorPhone || "305-283-0872"} o agenda aquí: ${calendly}`

  const emailHtml = `
    <p>Hola ${name},</p>
    <p>Intentamos comunicarnos contigo porque recientemente mostraste interés en <strong>${campaign}</strong> en Miami.</p>
    <p>Catherine Gomez Realtor tiene opciones exclusivas que se ajustan a lo que buscas. ¿Puedes tomar unos minutos para hablar?</p>
    <p><a href="${calendly}" style="background:#3b82f6;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin:8px 0">Agendar cita con Catherine →</a></p>
    <p>O llámanos directamente: <strong>${config?.realtorPhone || "305-283-0872"}</strong></p>
    <p>Saludos,<br/>El equipo de Catherine Gomez Realtor</p>
  `

  if (phone) {
    sendSMS(
      phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "").slice(-10)}`,
      smsBody
    ).catch(() => {})
  }

  if (contact.email) {
    const subject = `Intentamos contactarte sobre ${campaign}`
    sendEmail({ to: contact.email, subject, html: emailHtml, text: smsBody })
      .then(() =>
        prisma.email.create({
          data: {
            subject,
            body: emailHtml,
            fromAddress: process.env.RESEND_FROM || "sofia@loftycrm.com",
            toAddress: contact.email!,
            status: "SENT",
            sentAt: new Date(),
            contactId: contact.id,
          },
        }).catch(() => {})
      )
      .catch(() => {})
  }

  if (phone) {
    prisma.sMSMessage.create({
      data: {
        toNumber: phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "").slice(-10)}`,
        fromNumber: process.env.TWILIO_PHONE_NUMBER || "",
        body: smsBody,
        direction: "OUTBOUND",
        status: "SENT",
        contactId: contact.id,
      },
    }).catch(() => {})
  }
}

// ── Called from VAPI webhook when a call ends ─────────────────────────────────
export async function handleCallOutcome(
  contactId: string,
  endedReason: string,
  durationSeconds: number,
  calledByAgent?: boolean  // true = Catherine called manually, false/undefined = Sofía
) {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } })
  if (!contact) return

  const pipeline = await getPipeline()
  if (!pipeline) return

  const config = await prisma.aIConfig.findFirst()
  const stageByName = (name: string) => pipeline.stages.find(s => s.name === name)

  const engaged = !NO_ANSWER_REASONS.includes(endedReason) && durationSeconds > 30

  if (engaged) {
    const warmStage = stageByName("Warm")
    if (warmStage) {
      await moveToStage(contactId, warmStage.id, "Warm")
      // Cancel any pending Sofia retries — lead is engaged
      await prisma.scheduledCall.updateMany({
        where: { contactId, status: "PENDING" },
        data: { status: "CANCELLED" },
      })
      await prisma.aINotification.create({
        data: {
          type: "NEW_LEAD",
          title: `🔥 Lead caliente: ${contact.firstName} ${contact.lastName || ""}`,
          body: `Respondió la llamada de Sofía (${durationSeconds}s). Movido a Warm.`,
          priority: "HIGH",
          contactId,
        },
      })
      await createCatherineTask(
        contactId,
        `🔥 Seguimiento urgente — ${contact.firstName} ${contact.lastName || ""}`,
        `Respondió la llamada de Sofía (${durationSeconds}s). Hacer seguimiento inmediato.`
      )
    }
    return
  }

  if (!NO_ANSWER_REASONS.includes(endedReason)) return

  // No answer — advance through Contacted stages
  const currentStage = await getCurrentStage(contactId)
  const currentName = currentStage?.name ?? ""

  let nextStageName: string
  if (!currentName || !CONTACTED_STAGES.includes(currentName)) {
    nextStageName = "Contacted 1"
  } else {
    const idx = CONTACTED_STAGES.indexOf(currentName)
    nextStageName = idx < CONTACTED_STAGES.length - 1
      ? CONTACTED_STAGES[idx + 1]
      : "Drip Campaign"
  }

  const nextStage = stageByName(nextStageName)
  if (!nextStage) return

  await moveToStage(contactId, nextStage.id, nextStageName)

  if (nextStageName === "Drip Campaign") {
    // Check whether Catherine has EVER personally called this lead
    const catherineCallCount = await prisma.dialerCall.count({
      where: {
        contactId,
        agentId: { not: null },
        status: { in: ["COMPLETED", "NO_ANSWER", "BUSY"] },
      },
    })
    const neverCalledPersonally = catherineCallCount === 0
    const name = `${contact.firstName} ${contact.lastName ?? ""}`.trim()

    await prisma.aINotification.create({
      data: {
        type: "FOLLOW_UP",
        title: `⚠️ ${name} movido a Drip Campaign`,
        body: neverCalledPersonally
          ? `Sofía llamó 4 veces sin respuesta. TÚ NUNCA HAS LLAMADO A ESTE LEAD PERSONALMENTE. Considera hacer una llamada personal antes de que entre a la secuencia automática.`
          : `Sofía y tú han intentado contactar a ${name} sin éxito (${catherineCallCount} llamada${catherineCallCount > 1 ? "s" : ""} tuya${catherineCallCount > 1 ? "s" : ""}). Movido a secuencia automática.`,
        priority: neverCalledPersonally ? "HIGH" : "MEDIUM",
        contactId,
      },
    })
    return
  }

  // Contacted 1–4: send outreach text/email to lead + schedule Sofia's next call
  const attemptNum = CONTACTED_STAGES.indexOf(nextStageName) + 1
  await sendOutreachMessages(contact, nextStageName, config)
  // Only schedule Sofia retry if this wasn't Catherine's call — Catherine manages her own follow-up
  if (!calledByAgent) {
    await scheduleRetryCall(contactId, attemptNum + 1)
  }
  await prisma.aINotification.create({
    data: {
      type: "FOLLOW_UP",
      title: `Sin respuesta: ${contact.firstName} (intento ${attemptNum})`,
      body: calledByAgent
        ? `Tú llamaste a ${contact.firstName} — sin respuesta. Movido a ${nextStageName}. SMS y email enviados.`
        : `Movido a ${nextStageName}. SMS y email enviados. Sofía volverá a llamar en ${RETRY_DELAY_HOURS}h.`,
      priority: "MEDIUM",
      contactId,
    },
  })
}

// ── Called when lead replies via SMS, email, WhatsApp, or any channel ────────
export async function handleLeadEngaged(contactId: string, channel: string, messageSnippet?: string) {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } })
  if (!contact) return

  const pipeline = await getPipeline()
  if (!pipeline) return

  const currentStage = await getCurrentStage(contactId)
  const alreadyWarm = ["Warm", "Hot", "Appointment Set", "Showing"].includes(currentStage?.name ?? "")

  if (!alreadyWarm) {
    const warmStage = pipeline.stages.find(s => s.name === "Warm")
    if (warmStage) await moveToStage(contactId, warmStage.id, "Warm")
  }

  // Cancel pending Sofia retries
  await prisma.scheduledCall.updateMany({
    where: { contactId, status: "PENDING" },
    data: { status: "CANCELLED" },
  })

  // Pause all active smart plan (drip) enrollments — lead is now engaged
  const paused = await prisma.smartPlanEnrollment.updateMany({
    where: { contactId, status: "ACTIVE" },
    data: { status: "PAUSED" },
  })

  const drippingNote = paused.count > 0
    ? ` Paused ${paused.count} active drip sequence(s).`
    : ""

  const snippet = messageSnippet ? ` Mensaje: "${messageSnippet.slice(0, 80)}${messageSnippet.length > 80 ? "…" : ""}"` : ""

  if (!alreadyWarm) {
    await createCatherineTask(
      contactId,
      `🔥 Seguimiento urgente — ${contact.firstName} ${contact.lastName || ""}`,
      `El lead respondió via ${channel}.${drippingNote} Hacer seguimiento inmediato.`
    )
  }

  await prisma.aINotification.create({
    data: {
      type: "MESSAGE_RECEIVED",
      title: `🔥 ${contact.firstName} ${contact.lastName || ""} respondió via ${channel}`,
      body: `${alreadyWarm ? "Ya estaba en pipeline caliente." : "Movido a Warm pipeline."}${drippingNote}${snippet}`,
      priority: "HIGH",
      contactId,
    },
  })
}
