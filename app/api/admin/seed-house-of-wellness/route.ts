export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

/**
 * House of Wellness Brickell — lead nurture.
 *
 * Binds to the tag "House of Wellness", which is exactly what the Facebook lead
 * form's tracking parameters produce (utm_campaign = utm_content = "House of
 * Wellness"). The Facebook webhook applies utm_campaign and utm_content as CRM
 * tags, and applyTagAndEnroll() auto-enrols the contact in any active plan whose
 * trigger is CONTACT_TAGGED:<tagId> — so a lead from the ad lands in this plan
 * without anyone touching it. The /house-of-wellness landing page applies the
 * same tag, so both paths converge on one sequence.
 *
 * POST to re-run: it refreshes the copy in place and backfills anyone already
 * tagged who is not enrolled yet.
 *
 * Step timing note: the cron advances an enrolment by setting
 * nextStepAt = now + nextStep.delay days. `delay` is therefore the GAP from the
 * previous step, not days since enrolment. Cumulative day is in each comment.
 */

const TAG = "House of Wellness"
const PLAN_NAME = "House of Wellness Brickell — Nurture"

const BASE = "https://www.catherinegomezrealtor.com"
const PAGE = `${BASE}/house-of-wellness`
const BOOK = `${PAGE}#agendar`

const BTN = "background:#065F46;color:#ffffff;padding:15px 34px;border-radius:50px;text-decoration:none;font-weight:bold;display:inline-block"
const WRAP = "font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1C1917;line-height:1.6"

const cta = (label = "Agendar mi cita con Catherine") =>
  `<p style="text-align:center;margin:28px 0"><a href="${BOOK}" style="${BTN}">${label} →</a></p>`

const sign = `<p style="margin-top:26px">{agent_name}<br/><span style="color:#78716C;font-size:14px">Bienes raíces en Miami · {agent_phone}</span></p>`

const email = (subject: string, body: string) => ({
  type: "EMAIL" as const,
  subject,
  content: `<div style="${WRAP}">${body}${sign}</div>`,
})

/**
 * 15 touches over 30 days. The job of the sequence, in order: show up fast,
 * remove the "I can't buy in the US" blocker, make the money feel reachable,
 * explain what is actually different about this building, answer the rental and
 * cost questions honestly, and keep one single call to action — book the cita.
 *
 * Every claim here is one we can stand behind: no projected returns, and no
 * delivery date, because the developer confirms that in the contract.
 */
const STEPS = [
  // ── Day 0 — answer immediately, while they still remember the ad ──────────
  {
    type: "WHATSAPP" as const, delay: 0,
    content: `¡Hola {first_name}! 👋 Soy Sofía, del equipo de {agent_name}. Vi que te interesó House of Wellness en Brickell 🌿 Es la torre con más de 22,000 pies² dedicados a bienestar: spa, gimnasio, yoga, cold plunge y piscina en la azotea. Los estudios arrancan en $419,900 USD y la reserva es del 10%. Te mando todo aquí: ${PAGE} ¿Te gustaría que {agent_name} te explique los números de tu caso? Puedes elegir día y hora: ${BOOK}`,
  },
  {
    delay: 0,
    ...email(
      "{first_name}, esto es House of Wellness Brickell 🌿",
      `<p>Hola {first_name},</p>
<p>Gracias por tu interés. Te resumo en un minuto por qué este proyecto está llamando tanto la atención:</p>
<ul>
  <li><strong>Dónde:</strong> 152 SW 9th Street, en pleno Brickell — a una cuadra de Brickell City Centre, junto a The Underline y sobre el tren que llega al aeropuerto de Miami.</li>
  <li><strong>Qué es:</strong> 34 pisos, 656 residencias, y más de <strong>22,000 pies² dedicados al bienestar</strong>. No es un edificio con gimnasio: es un edificio construido alrededor de cómo quieres vivir.</li>
  <li><strong>Precio:</strong> estudios desde <strong>$419,900 USD</strong>.</li>
  <li><strong>Reserva:</strong> 10% al firmar — desde <strong>$41,990 USD</strong>. El resto se paga por etapas mientras se construye.</li>
</ul>
<p>En la página tienes las imágenes, los tipos de unidad, el plan de pagos completo y las preguntas que todo el mundo hace:</p>
<p style="text-align:center;margin:20px 0"><a href="${PAGE}" style="color:#065F46;font-weight:bold">Ver House of Wellness Brickell →</a></p>
<p>Y si prefieres que te lo explique en una llamada de 15 minutos, elige el día y la hora que te sirvan:</p>
${cta()}`,
    ),
  },

  // ── Day 1 — kill the biggest blocker before anything else ─────────────────
  {
    type: "WHATSAPP" as const, delay: 1,
    content: `{first_name}, la pregunta que más me hacen: "¿puedo comprar en Miami si no soy residente ni ciudadano?" 🛂 Sí. Un extranjero puede comprar a su nombre o con una empresa (LLC), sin residencia y sin crédito estadounidense. Incluso hay bancos que prestan a extranjeros con 30–40% de enganche. Si quieres que {agent_name} te explique cómo sería en tu caso: ${BOOK}`,
  },

  // ── Day 2 — make the money feel reachable, then put a human on it ─────────
  {
    delay: 1,
    ...email(
      "¿Cuánto necesitas de verdad para empezar? 💵",
      `<p>Hola {first_name},</p>
<p>Mucha gente ve "$419,900" y piensa que necesita esa cantidad hoy. No es así. En preconstrucción pagas <strong>por etapas, mientras se construye</strong>:</p>
<table cellpadding="10" cellspacing="0" style="width:100%;border-collapse:collapse;margin:18px 0">
  <tr style="background:#F5F5F4"><td><strong>10%</strong></td><td>Al firmar el contrato — <strong>desde $41,990 USD</strong></td></tr>
  <tr><td><strong>10%</strong></td><td>Durante 2026</td></tr>
  <tr style="background:#F5F5F4"><td><strong>10%</strong></td><td>Junio de 2027</td></tr>
  <tr><td><strong>10%</strong></td><td>Durante 2028</td></tr>
  <tr style="background:#F5F5F4"><td><strong>60%</strong></td><td>Al cierre, cuando te entregan el apartamento</td></tr>
</table>
<p>Es decir: para separar tu unidad hoy necesitas <strong>$41,990</strong>, no $419,900. Y tienes años para organizar el resto — o para financiarlo al cierre.</p>
<p>En tu cita te armo el cálculo exacto de la unidad que te interesa, incluyendo los gastos mensuales.</p>
${cta("Quiero mis números")}`,
    ),
  },
  {
    type: "TASK" as const, delay: 0,
    taskType: "CALL",
    taskTitle: "📞 Llamar a {first_name} — lead de House of Wellness (día 2)",
    content: `Lead nuevo de la campaña de Facebook "House of Wellness".\n\nObjetivo de la llamada: calificar y agendar.\n- ¿Para vivir o para invertir?\n- ¿Qué tipo de unidad? (estudio 371 sqft / 1 rec / 2 rec 620 sqft)\n- ¿Tiene los $41,990 de la reserva disponibles o los está organizando?\n- ¿Vive en EE.UU. o fuera? Si está fuera: explicar que puede comprar sin residencia.\n\nPágina del proyecto: ${PAGE}`,
  },

  // ── Day 3 — the differentiator: why THIS building and not another ─────────
  {
    type: "WHATSAPP" as const, delay: 1,
    content: `{first_name}, te explico qué hace diferente a House of Wellness 🌿 La mayoría de las torres de Brickell dedican UN piso a amenidades. Esta dedica más de 22,000 pies²: spa con sauna y hammam, cold plunge, estudios de yoga y meditación, gimnasio completo con entrenador, juice bar con nutricionista, y la piscina en la azotea con vista a la bahía. Lo usas todos los días sin salir de tu casa. Mira las imágenes: ${PAGE}#amenidades`,
  },

  // ── Day 4 — the rental question (the investor's real decision) ────────────
  {
    delay: 1,
    ...email(
      "¿Y si lo quiero rentar? Esto es lo que permite el edificio 🔑",
      `<p>Hola {first_name},</p>
<p>Si estás pensando en invertir, estas tres condiciones son las que de verdad importan — y es donde muchos edificios de Miami te amarran. Aquí no:</p>
<ul>
  <li><strong>Renta mínima de 15 días.</strong> Puedes rentar tu apartamento con estancias cortas, no solo con contratos de un año.</li>
  <li><strong>Sin programa de administración obligatorio.</strong> No te obligan a rentar a través del edificio ni a repartir tus ingresos. Rentas con quien tú quieras, o no rentas.</li>
  <li><strong>Sin límite de días para el dueño.</strong> Puedes vivir ahí todo el año, usarlo cuando viajes a Miami, o combinarlo. Tú decides.</li>
</ul>
<p>Esa combinación — renta corta permitida, sin administración forzada y sin tope de uso propio — es más rara de lo que parece en Brickell. Es la razón por la que este proyecto funciona igual de bien para quien quiere vivir que para quien quiere rentar.</p>
<p>¿Lo tuyo es vivir, rentar, o las dos? Dímelo en la cita y te muestro qué unidad te conviene.</p>
${cta()}`,
    ),
  },

  // ── Day 6 — short nudge ───────────────────────────────────────────────────
  {
    type: "SMS" as const, delay: 2,
    content: `{first_name}, soy del equipo de {agent_name}. ¿Te ayudo a ver si House of Wellness Brickell te conviene? Son 15 minutos y sales con números reales, sin compromiso: ${BOOK}`,
  },

  // ── Day 7 — the honest-costs email. Trust is built by saying the hard part ─
  {
    delay: 1,
    ...email(
      "Lo que nadie te cuenta: los costos reales de ser dueño en Miami",
      `<p>Hola {first_name},</p>
<p>Prefiero que sepas esto antes de comprar, no después. Ser dueño en Miami tiene dos costos fijos que debes sumar al precio:</p>
<ul>
  <li><strong>HOA (mantenimiento):</strong> estimado en <strong>$1.70 por pie² al mes</strong>. En un estudio de 371 pies², eso ronda los <strong>$630 mensuales</strong>. Cubre las amenidades, las áreas comunes, la seguridad y la administración on-site.</li>
  <li><strong>Impuestos de propiedad:</strong> aproximadamente <strong>1.8% del valor al año</strong>.</li>
</ul>
<p>Y un detalle práctico: <strong>las unidades no se entregan amuebladas.</strong> Si piensas rentar apenas te la entreguen, hay que presupuestar el mobiliario. Te puedo conectar con proveedores en Miami cuando llegue el momento.</p>
<p>Te digo todo esto porque la decisión correcta se toma con los números completos. En tu cita te hago el cálculo de tu unidad: cuota inicial, pagos por etapa, HOA, impuestos y lo que podrías esperar de renta.</p>
${cta("Ver mis números completos")}`,
    ),
  },

  // ── Day 9 — second human attempt ──────────────────────────────────────────
  {
    type: "TASK" as const, delay: 2,
    taskType: "CALL",
    taskTitle: "📞 Segundo intento — {first_name} (House of Wellness, día 9)",
    content: `Segundo contacto del nurture de House of Wellness. Si no contestó la primera vez, probar otro horario o WhatsApp.\n\nSi responde pero no está listo: averiguar el bloqueo real (¿presupuesto? ¿no entiende el proceso desde fuera de EE.UU.? ¿está comparando otros proyectos?) y anotarlo en el contacto.\n\nPágina: ${PAGE}`,
  },

  // ── Day 11 — trust: who is Catherine, why buy through her ─────────────────
  {
    type: "WHATSAPP" as const, delay: 2,
    content: `{first_name}, una cosa importante: comprar preconstrucción en Miami desde fuera se puede hacer completo a distancia, pero necesitas a alguien que te acompañe en español en cada paso — contrato, abogado, depósito en escrow, financiamiento y cierre. Eso es lo que hace {agent_name}, y no te cuesta nada: en preconstrucción al comprador lo representa el desarrollador. ¿Hablamos? ${BOOK}`,
  },

  // ── Day 14 — the FAQ digest, for the ones who read before they talk ───────
  {
    delay: 3,
    ...email(
      "Las 5 preguntas que me hacen todos los días sobre House of Wellness",
      `<p>Hola {first_name},</p>
<p><strong>1. ¿Puedo comprar sin ser residente de Estados Unidos?</strong><br/>
Sí. A tu nombre o con una LLC, sin residencia y sin crédito estadounidense. Hay préstamos para extranjeros con 30–40% de enganche.</p>
<p><strong>2. ¿Cuánto necesito hoy?</strong><br/>
El 10% de reserva — desde $41,990 USD. El resto se paga por etapas durante la construcción.</p>
<p><strong>3. ¿Puedo rentarlo por Airbnb?</strong><br/>
El edificio permite renta con mínimo de 15 días, sin programa de administración obligatorio.</p>
<p><strong>4. ¿Puedo quedarme yo cuando quiera?</strong><br/>
Sí, no hay límite de días para el dueño. Puedes vivir ahí todo el año si quieres.</p>
<p><strong>5. ¿Cuándo lo entregan?</strong><br/>
La fecha vigente la confirma el desarrollador al momento de la reserva y queda por escrito en tu contrato. Pregúntamela en la cita y te doy la que está confirmada hoy.</p>
<p>¿Tienes una pregunta que no está aquí? Esa es exactamente la razón de la cita.</p>
${cta("Hacer mis preguntas")}`,
    ),
  },

  // ── Day 18 — honest urgency: inventory and price lists move ──────────────
  {
    type: "WHATSAPP" as const, delay: 4,
    content: `{first_name}, un aviso honesto: en preconstrucción las listas de precios suben por etapas y las mejores líneas (las de vista y los pisos altos) se van primero. No te estoy apurando — pero si House of Wellness te interesa, vale la pena ver qué queda hoy antes de que cambie la lista. Son 15 minutos: ${BOOK}`,
  },

  // ── Day 23 — the clean re-engagement ──────────────────────────────────────
  {
    delay: 5,
    ...email(
      "{first_name}, ¿lo dejamos para más adelante?",
      `<p>Hola {first_name},</p>
<p>No quiero llenarte el correo si este no es tu momento — así que te lo pregunto directo. Responde con una palabra:</p>
<ul>
  <li><strong>"Ahora"</strong> — y agendamos esta semana.</li>
  <li><strong>"Después"</strong> — y te escribo solo cuando haya algo que de verdad valga la pena (una nueva lista de precios, una unidad que calce con lo que buscas).</li>
  <li><strong>"No"</strong> — y no te escribo más. Sin problema.</li>
</ul>
<p>Y si lo que pasa es que tienes una duda que no te he resuelto, dímela. Prefiero resolverla a que te quedes con ella.</p>
${cta("Prefiero agendar")}`,
    ),
  },

  // ── Day 30 — last human touch, then triage ───────────────────────────────
  {
    type: "TASK" as const, delay: 7,
    taskType: "CALL",
    taskTitle: "📞 Último intento + decidir — {first_name} (House of Wellness, día 30)",
    content: `Cierre del nurture de 30 días de House of Wellness.\n\nSi contesta: agendar, o entender qué lo detiene.\nSi no contesta ni ha abierto nada: marcar el contacto y pasarlo al nurture general de Miami en vez de dejarlo sin seguimiento.\n\nAnotar el resultado en el contacto para saber qué tan bien funcionó esta campaña.`,
  },
]

async function seed(userId?: string) {
  const tag = await prisma.tag.upsert({
    where: { name: TAG },
    update: {},
    create: { name: TAG, color: "#059669" },
  })

  const stepData = STEPS.map((s, i) => ({
    order: i,
    type: s.type ?? "EMAIL",
    delay: s.delay,
    subject: "subject" in s ? s.subject ?? null : null,
    content: "content" in s ? s.content ?? null : null,
    taskTitle: "taskTitle" in s ? s.taskTitle ?? null : null,
    taskType: "taskType" in s ? s.taskType ?? null : null,
  }))

  const description = `Nurture de 30 días para los leads de la campaña de Facebook "House of Wellness" (Brickell). Educa, resuelve las objeciones de comprar desde fuera de EE.UU. y empuja a una sola acción: agendar la cita. Se activa solo con la etiqueta "${TAG}" — que es el utm_campaign y el utm_content del formulario de Facebook, y la etiqueta que aplica la página ${PAGE}.`

  const existing = await prisma.smartPlan.findFirst({ where: { name: PLAN_NAME } })
  let planId: string
  if (existing) {
    await prisma.smartPlanStep.deleteMany({ where: { planId: existing.id } })
    await prisma.smartPlan.update({
      where: { id: existing.id },
      data: { description, trigger: `CONTACT_TAGGED:${tag.id}`, isActive: true, steps: { create: stepData } },
    })
    planId = existing.id
  } else {
    const plan = await prisma.smartPlan.create({
      data: {
        name: PLAN_NAME,
        description,
        trigger: `CONTACT_TAGGED:${tag.id}`,
        isActive: true,
        userId,
        steps: { create: stepData },
      },
    })
    planId = plan.id
  }

  // Backfill anyone already carrying the tag who is not enrolled yet.
  const tagged = await prisma.contactTag.findMany({ where: { tagId: tag.id }, select: { contactId: true } })
  let enrolled = 0
  for (const { contactId } of tagged) {
    const already = await prisma.smartPlanEnrollment.findFirst({
      where: { contactId, planId, status: "ACTIVE" },
    })
    if (!already) {
      await prisma.smartPlanEnrollment.create({
        data: { contactId, planId, status: "ACTIVE", currentStep: 0, nextStepAt: new Date() },
      })
      enrolled++
    }
  }

  return { plan: PLAN_NAME, planId, tag: tag.name, tagId: tag.id, steps: stepData.length, tagged: tagged.length, enrolled }
}

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const result = await seed(session.user?.id as string)
  return NextResponse.json({ ok: true, ...result })
}
