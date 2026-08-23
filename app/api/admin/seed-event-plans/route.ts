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
// These tag strings MUST match each Facebook form's utm_content EXACTLY.
const EVENTS = [
  // Bogotá tag confirmed from a real imported lead's utm_content: "Evento Septiembre 2026 Bogota".
  { tag: "Evento Septiembre 2026 Bogota", city: "Bogotá", dateLabel: "25 y 26 de septiembre", link: BOGOTA_LINK },
  { tag: "Evento Medellin Septiembre 2026", city: "Medellín", dateLabel: "23 de septiembre", link: MEDELLIN_LINK },
]

function steps(city: string, dateLabel: string, link: string) {
  return [
    // Day 0 — welcome + excitement + register
    { type: "WHATSAPP", delay: 0, content: `¡Hola {first_name}! 🎉 Soy Sofía, de Catherine Gómez Realtor. ¡Qué emoción que te unas a nuestro Evento de Inversión en Miami en ${city} (${dateLabel})! 🏙️ Va a ser una noche que puede cambiar tu futuro financiero. 🎟️ Asegura tu lugar GRATIS (cupos limitados): ${link}` },
    { type: "EMAIL", delay: 0, subject: `🎟️ {first_name}, estás dentro — Evento de Inversión en Miami (${city})`, content: `<p>¡Hola {first_name}! 🎉</p><p>Prepárate, porque el <strong>${dateLabel}</strong> en <strong>${city}</strong> vas a vivir una noche exclusiva donde te mostramos, paso a paso, cómo invertir en Miami desde Colombia.</p><p><strong>Esto es lo que descubrirás:</strong></p><ul><li>🏦 Cómo comprar en Miami <strong>sin ciudadanía</strong> — solo tu pasaporte</li><li>💵 Financiamiento para extranjeros (30–40% de enganche)</li><li>🏗️ Proyectos de preconstrucción con alta plusvalía</li><li>🏠 Cómo generar <strong>renta en dólares</strong> mientras tu patrimonio crece</li><li>🤝 Conocerás a Catherine en persona y podrás hacerle TODAS tus preguntas</li></ul><p style="text-align:center;margin:26px 0"><a href="${link}" style="background:#1E3A5F;color:#C9A84C;padding:15px 34px;border-radius:50px;text-decoration:none;font-weight:bold;display:inline-block">🎟️ Confirmar mi lugar gratis →</a></p><p>Los cupos son <strong>limitados</strong> y se llenan rápido. ¡Nos vemos en ${city}! 🚀<br/>{agent_name}</p>` },
    // Day 1 — education (why Miami) + build anticipation
    { type: "WHATSAPP", delay: 1, content: `{first_name}, ¿sabías que Miami subió +60% en valor en los últimos 5 años? 📈 Imagina tu dinero creciendo en dólares mientras el peso se devalúa. Eso es exactamente lo que veremos juntos en ${city}. ¿Ya aseguraste tu lugar? 👉 ${link}` },
    { type: "EMAIL", delay: 2, subject: `${city}: esto es lo que vas a aprender en el evento 🇨🇴🏙️`, content: `<p>Hola {first_name},</p><p>Faltan pocos días para nuestro evento en <strong>${city}</strong> (${dateLabel}) y quiero que llegues preparado(a) para aprovecharlo al máximo.</p><p><strong>La agenda de la noche:</strong></p><ul><li>Por qué Miami es el destino #1 para inversionistas latinoamericanos</li><li>El proceso de compra, de principio a fin, desde Colombia</li><li>Casos reales de colombianos que ya invierten y ganan en dólares</li><li>Oportunidades de preconstrucción disponibles AHORA</li></ul><p>Ven con tus preguntas — Catherine estará ahí para responderlas en persona.</p><p style="text-align:center;margin:22px 0"><a href="${link}" style="background:#1E3A5F;color:#C9A84C;padding:14px 30px;border-radius:50px;text-decoration:none;font-weight:bold;display:inline-block">🎟️ Ver mi lugar →</a></p><p>{agent_name}</p>` },
    // Day 3 — urgency
    { type: "SMS", delay: 3, content: `{first_name}, los cupos para el evento de inversión en Miami en ${city} (${dateLabel}) se están agotando. ¿Ya reservaste el tuyo? 👉 ${link}` },
    // Day 4 — agent task
    { type: "TASK", delay: 4, taskType: "CALL", taskTitle: `📞 Llamar a {first_name} — confirmar asistencia al evento (${city})`, content: `Lead del evento de ${city} (${dateLabel}). Genera entusiasmo, confirma si ya reservó su ticket; si no, ayúdale a registrarse: ${link}` },
    // Day 5 — last-call urgency
    { type: "EMAIL", delay: 5, subject: `⏰ {first_name}, se acaban los cupos — Evento en ${city}`, content: `<p>Hola {first_name},</p><p>No quiero que te quedes por fuera. Quedan <strong>pocos lugares</strong> para el evento en <strong>${city}</strong> el <strong>${dateLabel}</strong>, y esta es una oportunidad real para dar el primer paso hacia tu inversión en Miami.</p><p style="text-align:center;margin:24px 0"><a href="${link}" style="background:#C9A84C;color:#1E3A5F;padding:15px 34px;border-radius:50px;text-decoration:none;font-weight:bold;display:inline-block">🎟️ Reservar mi lugar ahora →</a></p><p>¡Nos vemos pronto en ${city}! 🚀<br/>{agent_name}</p>` },
  ] as const
}

async function seedOne(ev: { tag: string; city: string; dateLabel: string; link: string }, userId?: string) {
  // Bind to the tag the Facebook form ACTUALLY created — matched case-insensitively
  // so capitalization differences (e.g. "Septiembre" vs "septiembre") don't matter.
  // Only creates a new tag if none exists yet (send a test lead first so it does).
  let tag = await prisma.tag.findFirst({ where: { name: { equals: ev.tag, mode: "insensitive" } }, select: { id: true, name: true } })
  if (!tag) tag = await prisma.tag.create({ data: { name: ev.tag, color: "#7C3AED" }, select: { id: true, name: true } })
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
  return { plan: name, tag: tag.name, enrolled, tagged: tagged.length }
}

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const results = []
  for (const ev of EVENTS) results.push(await seedOne(ev, session.user?.id as string))
  return NextResponse.json({ ok: true, results })
}
