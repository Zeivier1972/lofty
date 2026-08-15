export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// Creates the September event "Reserva tu Ticket" nurture plans (Bogotá +
// Medellín), triggered by each event's tag (the Facebook form's utm_content), and
// backfills anyone already tagged. Re-run to refresh the copy.

const BOGOTA_LINK = "https://www.eventbrite.com/e/1998107399018?aff=oddtdtcreator"
const MEDELLIN_LINK = "https://www.eventbrite.com/e/1998110626672?aff=oddtdtcreator"

// NOTE: these tag strings must match the form's utm_content EXACTLY.
const EVENTS = [
  { tag: "Evento Septiembre 2026 B", city: "Bogotá", dateLabel: "24 y 25 de septiembre", link: BOGOTA_LINK },
  { tag: "Evento Medellin Septiembre 2026", city: "Medellín", dateLabel: "23 de septiembre", link: MEDELLIN_LINK },
]

function steps(city: string, dateLabel: string, link: string) {
  return [
    { type: "WHATSAPP", delay: 0, content: `Hola {first_name} 👋 Soy Sofía, de Catherine Gómez Realtor. ¡Gracias por tu interés en nuestro evento de inversión en Miami en ${city} (${dateLabel})! 🎟️ Asegura tu lugar GRATIS aquí: ${link}` },
    { type: "EMAIL", delay: 0, subject: `{first_name}, reserva tu lugar — Evento de Inversión en Miami (${city})`, content: `<p>¡Hola {first_name}!</p><p>Gracias por tu interés en nuestro evento exclusivo de inversión en bienes raíces en Miami, en <strong>${city}</strong> el <strong>${dateLabel}</strong>.</p><p>En el evento aprenderás:</p><ul><li>Cómo invertir en Miami desde Colombia (sin ciudadanía)</li><li>Financiamiento para extranjeros (30–40% de enganche)</li><li>Proyectos de preconstrucción con alta plusvalía</li><li>Cómo generar renta en dólares</li></ul><p><a href="${link}" style="background:#2563eb;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">🎟️ Reserva tu lugar gratis →</a></p><p>Los cupos son limitados. ¡Nos vemos en ${city}!<br/>{agent_name}</p>` },
    { type: "EMAIL", delay: 2, subject: `Por qué los colombianos están invirtiendo en Miami 🇨🇴🏙️`, content: `<p>Hola {first_name},</p><p>Miami es el destino #1 para inversionistas latinoamericanos: capital en dólares, plusvalía comprobada y financiamiento para extranjeros.</p><p>En nuestro evento en ${city} (${dateLabel}) te mostramos exactamente cómo hacerlo, paso a paso.</p><p><a href="${link}">🎟️ Reserva tu lugar →</a></p><p>{agent_name}</p>` },
    { type: "SMS", delay: 3, content: `Hola {first_name}, ¿ya reservaste tu lugar para el evento de inversión en Miami en ${city} (${dateLabel})? Cupos limitados 👉 ${link}` },
    { type: "EMAIL", delay: 5, subject: `⏰ Últimos cupos — Evento en ${city}`, content: `<p>Hola {first_name},</p><p>Quedan pocos lugares para el evento en <strong>${city}</strong> el <strong>${dateLabel}</strong>. No te quedes por fuera.</p><p><a href="${link}" style="background:#2563eb;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">🎟️ Reservar ahora →</a></p><p>{agent_name}</p>` },
    { type: "TASK", delay: 4, taskType: "CALL", taskTitle: `📞 Llamar a {first_name} — confirmar asistencia (${city})`, content: `Lead del evento de ${city} (${dateLabel}). Confirmar si ya reservó su ticket; si no, ayudarle a reservar: ${link}` },
  ] as const
}

async function seedOne(ev: { tag: string; city: string; dateLabel: string; link: string }, userId?: string) {
  const tag = await prisma.tag.upsert({ where: { name: ev.tag }, update: {}, create: { name: ev.tag, color: "#7C3AED" } })
  const name = `Evento ${ev.city} — Reserva tu Ticket`
  const stepData = steps(ev.city, ev.dateLabel, ev.link).map((s, i) => ({
    order: i, type: s.type, delay: s.delay,
    subject: "subject" in s ? s.subject : null,
    content: "content" in s ? s.content : null,
    taskTitle: "taskTitle" in s ? s.taskTitle : null,
    taskType: "taskType" in s ? s.taskType : null,
  }))

  const existing = await prisma.smartPlan.findFirst({ where: { name } })
  let planId: string
  if (existing) {
    await prisma.smartPlanStep.deleteMany({ where: { planId: existing.id } })
    await prisma.smartPlan.update({ where: { id: existing.id }, data: { trigger: `CONTACT_TAGGED:${tag.id}`, isActive: true, steps: { create: stepData } } })
    planId = existing.id
  } else {
    const plan = await prisma.smartPlan.create({
      data: {
        name,
        description: `Nurture para asistentes del evento de ${ev.city} (${ev.dateLabel}). Los lleva a reservar su ticket. Se detiene solo cuando confirman su ticket en Eventbrite. Tag: "${ev.tag}".`,
        trigger: `CONTACT_TAGGED:${tag.id}`, isActive: true, userId,
        steps: { create: stepData },
      },
    })
    planId = plan.id
  }

  // Backfill existing tagged leads not already enrolled.
  const tagged = await prisma.contactTag.findMany({ where: { tagId: tag.id }, select: { contactId: true } })
  let enrolled = 0
  for (const { contactId } of tagged) {
    const already = await prisma.smartPlanEnrollment.findFirst({ where: { contactId, planId, status: "ACTIVE" } })
    if (!already) {
      await prisma.smartPlanEnrollment.create({ data: { contactId, planId, status: "ACTIVE", currentStep: 0, nextStepAt: new Date() } })
      enrolled++
    }
  }
  return { plan: name, tag: ev.tag, enrolled, tagged: tagged.length }
}

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const results = []
  for (const ev of EVENTS) results.push(await seedOne(ev, session.user?.id as string))
  return NextResponse.json({ ok: true, results })
}
