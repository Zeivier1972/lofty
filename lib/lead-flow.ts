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
import { sendSMS, toE164 } from "@/lib/sms"
import { sendEmail } from "@/lib/email"

const CONTACTED_STAGES = ["Contacted 1", "Contacted 2", "Contacted 3", "Contacted 4"]

// A call is "engaged" only if the customer actually talked to Sofia for > 30s.
// Everything else (voicemail, no-answer, error codes, short pick-ups, unknown) is
// treated as a no-answer contact attempt and advances the Contacted stage.
const CONNECTED_REASONS = new Set(["customer-ended-call", "assistant-ended-call"])

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

  // Anti-spam: if this lead already got an automated text OR email in the last
  // ~20h, skip this whole outreach. Stops the burst when a lead advances
  // through several Contacted stages quickly (multiple no-answer calls).
  const gapH = Number(process.env.OUTREACH_MIN_GAP_HOURS || 20)
  const since = new Date(Date.now() - gapH * 3600 * 1000)
  const [recentSMS, recentEmail] = await Promise.all([
    prisma.sMSMessage.findFirst({
      where: { contactId: contact.id, direction: "OUTBOUND", createdAt: { gte: since }, status: { notIn: ["FAILED", "UNDELIVERED", "BLOCKED"] } },
      select: { id: true },
    }).catch(() => null),
    prisma.email.findFirst({
      where: { contactId: contact.id, direction: "OUTBOUND", createdAt: { gte: since }, status: "SENT" },
      select: { id: true },
    }).catch(() => null),
  ])
  if (recentSMS || recentEmail) {
    console.log(`[lead-flow] Skipping outreach to ${contact.id} — already contacted within ${gapH}h`)
    return
  }

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
    const toPhone = toE164(phone)
    sendSMS(toPhone, smsBody, undefined, { automated: true, contactId: contact.id })
      .then((sid) => {
        if (!sid) return // throttled or blocked — nothing sent, don't log a send
        prisma.activity.create({
          data: { type: "SMS", title: "Sofía sent outreach SMS", description: smsBody.slice(0, 200), contactId: contact.id },
        }).catch(() => {})
        prisma.sMSMessage.create({
          data: { toNumber: toPhone, fromNumber: process.env.TWILIO_PHONE_NUMBER || "", body: smsBody, direction: "OUTBOUND", status: "SENT", contactId: contact.id },
        }).catch(() => {})
      })
      .catch(() => {})
  }

  if (contact.email && !contact.doNotEmail) {
    const subject = `Intentamos contactarte sobre ${campaign}`
    sendEmail({ to: contact.email, subject, html: emailHtml, text: smsBody })
      .then(() => {
        prisma.email.create({
          data: {
            subject,
            body: emailHtml,
            fromAddress: process.env.RESEND_FROM || "sofia@casaicrm.com",
            toAddress: contact.email!,
            status: "SENT",
            sentAt: new Date(),
            contactId: contact.id,
          },
        }).catch(() => {})
        prisma.activity.create({
          data: { type: "EMAIL_SENT", title: "Sofía sent outreach email", description: subject, contactId: contact.id },
        }).catch(() => {})
      })
      .catch(() => {})
  }
}

// Manually moving a lead INTO a Contacted 1-4 stage (single or bulk) should
// fire the outreach text+email ONCE — same message the call flow sends. The
// per-contact cooldown inside sendOutreachMessages prevents doubles. No-op for
// any non-Contacted stage (New Leads, Warm, Hot, Drip, Closed, etc.), so
// reorganizing across those stages never messages anyone.
export async function triggerStageOutreach(contactId: string, stageName: string): Promise<void> {
  if (!CONTACTED_STAGES.includes(stageName)) return
  try {
    const contact = await prisma.contact.findUnique({ where: { id: contactId } })
    if (!contact) return
    const config = await prisma.aIConfig.findFirst().catch(() => null)
    await sendOutreachMessages(contact, stageName, config)
  } catch (e) {
    console.error("[triggerStageOutreach]", (e as Error).message)
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

  const callConnected = CONNECTED_REASONS.has(endedReason)
  const engaged = callConnected && (calledByAgent ? true : durationSeconds > 30)

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

  // All non-engaged calls (voicemail, no-answer, error codes, short pick-ups) advance
  // the lead through the Contacted stages. Do NOT filter on a fixed list of reason codes —
  // VAPI/Twilio can return unexpected values that would silently break advancement.

  // No answer — advance through Contacted stages
  const currentStage = await getCurrentStage(contactId)
  const currentName = currentStage?.name ?? ""

  // Don't touch leads already past the calling flow (Drip, Warm, Hot, etc.)
  const PAST_CALLING_STAGES = ["Drip Campaign", "Warm", "Hot", "Appointment Set", "Showing", "Under Contract", "Closed"]
  if (currentName && PAST_CALLING_STAGES.includes(currentName)) {
    console.log(`[lead-flow] Skipping stage advance — ${contact.firstName} is already at "${currentName}"`)
    return
  }

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
  // Sofia always keeps the 24h retry cycle going, regardless of who last called
  const attemptNum = CONTACTED_STAGES.indexOf(nextStageName) + 1
  await sendOutreachMessages(contact, nextStageName, config)
  await scheduleRetryCall(contactId, attemptNum + 1)
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
// Notify Catherine directly (SMS + email) when a lead replies to Sofia, so she
// never misses a live conversation. Uses realtorPhone/realtorEmail from AIConfig.
export async function notifyAgentOfLeadReply(
  contact: { id: string; firstName: string; lastName: string | null; phone: string | null },
  channel: string,
  message: string
) {
  try {
    const config = await prisma.aIConfig.findFirst({
      select: { realtorPhone: true, realtorEmail: true },
    }).catch(() => null)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"
    const agentPhone = config?.realtorPhone || process.env.REALTOR_PHONE
    const agentEmail = config?.realtorEmail || process.env.REALTOR_EMAIL
    const name = `${contact.firstName} ${contact.lastName || ""}`.trim()
    const link = `${appUrl}/contacts/${contact.id}`
    const snippet = message.slice(0, 160)

    if (agentPhone) {
      await sendSMS(agentPhone, `💬 ${name} respondió por ${channel}: "${snippet}"\nVer: ${link}`).catch(() => {})
    }
    if (agentEmail) {
      await sendEmail({
        to: agentEmail,
        subject: `💬 ${name} respondió por ${channel}`,
        html: `<p><strong>${name}</strong> respondió a Sofía por ${channel}:</p>
               <blockquote style="border-left:3px solid #c9a84c;padding-left:12px;color:#374151">${snippet}</blockquote>
               <p><a href="${link}">Abrir la conversación en el CRM →</a></p>`,
      }).catch(() => {})
    }
  } catch (e) {
    console.error("[notifyAgentOfLeadReply]", e)
  }
}

export async function handleLeadEngaged(contactId: string, channel: string, messageSnippet?: string) {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } })
  if (!contact) return

  const pipeline = await getPipeline()
  if (!pipeline) return

  const currentStage = await getCurrentStage(contactId)
  const alreadyWarm = ["Warm", "Hot", "Appointment Set", "Showing"].includes(currentStage?.name ?? "")

  // Cancel pending Sofia retries
  await prisma.scheduledCall.updateMany({
    where: { contactId, status: "PENDING" },
    data: { status: "CANCELLED" },
  })

  // Pause all active smart plan (drip) enrollments BEFORE moving to Warm —
  // moveToStage enrolls PIPELINE_STAGE:Warm plans, and pausing afterwards
  // would race and could pause the just-created Warm enrollment.
  const paused = await prisma.smartPlanEnrollment.updateMany({
    where: { contactId, status: "ACTIVE" },
    data: { status: "PAUSED" },
  })

  if (!alreadyWarm) {
    const warmStage = pipeline.stages.find(s => s.name === "Warm")
    if (warmStage) await moveToStage(contactId, warmStage.id, "Warm")
  }

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
