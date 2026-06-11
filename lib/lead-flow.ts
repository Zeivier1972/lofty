/**
 * Automated lead nurturing flow.
 *
 * Stage progression on no-answer calls:
 *   New / none → Contacted 1 → Contacted 2 → Contacted 3 → Contacted 4 → Drip Campaign
 *
 * Any engagement (answers call >30s, replies to SMS/email) → Warm
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
  })
  return lead?.stage ?? null
}

async function moveToStage(contactId: string, stageId: string, stageName: string) {
  const existing = await prisma.pipelineLead.findFirst({ where: { contactId } })
  if (existing) {
    await prisma.pipelineLead.update({ where: { id: existing.id }, data: { stageId } })
  } else {
    await prisma.pipelineLead.create({ data: { contactId, stageId } })
  }
  await prisma.activity.create({
    data: { type: "PIPELINE_MOVED", title: `Movido a ${stageName} (automático)`, contactId },
  })
}

async function createCatherineTask(contactId: string, title: string, description?: string) {
  // Assign to the first user in the DB (Catherine)
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
    sendEmail({
      to: contact.email,
      subject: `Intentamos contactarte sobre ${campaign}`,
      html: emailHtml,
      text: smsBody,
    }).catch(() => {})
  }

  // Store outbound SMS in DB
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
  durationSeconds: number
) {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } })
  if (!contact) return

  const pipeline = await getPipeline()
  if (!pipeline) return

  const config = await prisma.aIConfig.findFirst()

  const stageByName = (name: string) => pipeline.stages.find(s => s.name === name)

  const engaged = !NO_ANSWER_REASONS.includes(endedReason) && durationSeconds > 30

  if (engaged) {
    // Lead answered and talked — move to Warm
    const warmStage = stageByName("Warm")
    if (warmStage) {
      await moveToStage(contactId, warmStage.id, "Warm")
      await prisma.aINotification.create({
        data: {
          type: "NEW_LEAD",
          title: `🔥 Lead caliente: ${contact.firstName} ${contact.lastName || ""}`,
          body: `Respondió la llamada de Sofía (${durationSeconds}s). Movido a Warm.`,
          priority: "HIGH",
          contactId,
        },
      })
    }
    return
  }

  if (!NO_ANSWER_REASONS.includes(endedReason)) return // some other outcome, skip

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
    await createCatherineTask(
      contactId,
      `Agregar a drip campaign — ${contact.firstName} ${contact.lastName || ""}`,
      "4 intentos de llamada sin respuesta. Enrolar en drip campaign."
    )
    await prisma.aINotification.create({
      data: {
        type: "FOLLOW_UP",
        title: `${contact.firstName} movido a Drip Campaign`,
        body: "4 intentos sin respuesta. Agregar a secuencia automatizada.",
        priority: "MEDIUM",
        contactId,
      },
    })
    return
  }

  // Contacted 1–4: send outreach + create task
  const attemptNum = CONTACTED_STAGES.indexOf(nextStageName) + 1
  await sendOutreachMessages(contact, nextStageName, config)
  await createCatherineTask(
    contactId,
    `Llamar a ${contact.firstName} ${contact.lastName || ""} — intento ${attemptNum}`,
    `Sofía llamó sin respuesta. Intento de contacto #${attemptNum}.`
  )
  await prisma.aINotification.create({
    data: {
      type: "FOLLOW_UP",
      title: `Sin respuesta: ${contact.firstName} (intento ${attemptNum})`,
      body: `Movido a ${nextStageName}. SMS y email enviados. Tarea creada para Catherine.`,
      priority: "MEDIUM",
      contactId,
    },
  })
}

// ── Called when lead replies via SMS, email, or any channel ──────────────────
export async function handleLeadEngaged(contactId: string, channel: string) {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } })
  if (!contact) return

  const pipeline = await getPipeline()
  if (!pipeline) return

  const currentStage = await getCurrentStage(contactId)
  // Already warm or further — don't downgrade
  if (currentStage?.name === "Warm" || currentStage?.name === "Hot" ||
      currentStage?.name === "Appointment Set" || currentStage?.name === "Showing") return

  const warmStage = pipeline.stages.find(s => s.name === "Warm")
  if (!warmStage) return

  await moveToStage(contactId, warmStage.id, "Warm")
  await createCatherineTask(
    contactId,
    `🔥 Seguimiento urgente — ${contact.firstName} ${contact.lastName || ""}`,
    `El lead respondió via ${channel}. Moverlo a caliente y hacer seguimiento inmediato.`
  )
  await prisma.aINotification.create({
    data: {
      type: "MESSAGE_RECEIVED",
      title: `🔥 Lead respondió via ${channel}: ${contact.firstName} ${contact.lastName || ""}`,
      body: "Movido a Warm. Tarea de seguimiento creada para Catherine.",
      priority: "HIGH",
      contactId,
    },
  })
}
