import Anthropic from "@anthropic-ai/sdk"
import { prisma } from "./prisma"
import { sendSMS } from "./sms"
import { sendEmail } from "./email"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" })

interface AgentContext {
  contact: {
    id: string
    firstName: string
    lastName: string
    email?: string | null
    phone?: string | null
    status: string
    leadScore: number
    buyerBudgetMin?: number | null
    buyerBudgetMax?: number | null
    buyerLocation?: string | null
    buyerBedroomsMin?: number | null
  }
  trigger:
    | "PROPERTY_SAVED"
    | "PROPERTY_VIEWED_3X"
    | "SEARCH_BEHAVIOR"
    | "NEW_LEAD"
    | "FOLLOW_UP"
    | "open_house_visit"
    | "PRE_QUALIFY"
    | "APPOINTMENT_REQUEST"
  property?: {
    id: string
    address: string
    city: string
    state: string
    price: number
    bedrooms?: number | null
    bathrooms?: number | null
    sqft?: number | null
    images?: string
  }
  searchCriteria?: {
    minPrice?: number
    maxPrice?: number
    bedrooms?: number
    location?: string
    propertyType?: string
  }
  recentSearches?: number
}

// Pre-qualification questions in Spanish (+ English)
export const PRE_QUAL_QUESTIONS = [
  {
    id: "intent",
    es: "¿Estás buscando comprar o rentar una propiedad?",
    en: "Are you looking to buy or rent a property?",
  },
  {
    id: "timeline",
    es: "¿Cuándo planeas mudarte? (ej: 1-3 meses, 3-6 meses, más de 6 meses)",
    en: "When are you planning to move? (e.g., 1-3 months, 3-6 months, 6+ months)",
  },
  {
    id: "preapproved",
    es: "¿Ya tienes una pre-aprobación para tu préstamo hipotecario?",
    en: "Do you already have a mortgage pre-approval?",
  },
  {
    id: "budget",
    es: "¿Cuál es tu presupuesto aproximado? (ej: $300,000 - $400,000)",
    en: "What is your approximate budget? (e.g., $300,000 - $400,000)",
  },
  {
    id: "bedrooms",
    es: "¿Cuántos cuartos necesitas mínimo?",
    en: "How many bedrooms do you need at minimum?",
  },
  {
    id: "location",
    es: "¿En qué ciudad o área deseas comprar?",
    en: "Which city or area are you interested in?",
  },
  {
    id: "first_time",
    es: "¿Es esta tu primera vez comprando una casa?",
    en: "Is this your first time buying a home?",
  },
]

function buildSystemPrompt(config: any): string {
  const bookingLink = config.calendlyUrl
    ? `\nEnlace de citas de Catherine: ${config.calendlyUrl}`
    : ""

  return `Eres ${config.agentName}, la asistente virtual de bienes raíces de ${config.realtorName}.

PERSONALIDAD:
- Hablas principalmente en ESPAÑOL. Siempre incluye una traducción al inglés debajo.
- Eres cálida, amigable, profesional y confiable.
- Tu objetivo es construir confianza con los clientes y conectarlos con Catherine.
- Siempre eres alentadora y positiva.
- Usas el nombre del cliente cuando te diriges a ellos.
- Nunca presionas — guías con empatía.

MISIÓN PRINCIPAL:
1. Pre-calificar leads nuevos con preguntas clave
2. Para CUALQUIER actividad, siempre intentas agendar una llamada telefónica o cita de Zoom con ${config.realtorName}
3. Educar a compradores de primera vez sobre el proceso
4. Responder preguntas sobre propiedades y el mercado inmobiliario
5. Mantener a Catherine informada de todo

REGLAS DE MENSAJES:
- SMS: máximo 160 caracteres. Siempre en español primero, luego inglés separado por "|"
- Email: sección en español, luego sección en inglés
- Asuntos de email: "Asunto en español / English Subject"
- SIEMPRE incluye un llamado a la acción para agendar cita

DATOS DEL AGENTE:
- Nombre: ${config.realtorName}
- Teléfono: ${config.realtorPhone || "disponible por solicitud"}
- Email: ${config.realtorEmail || "disponible por solicitud"}${bookingLink}

IMPORTANTE: Cuando la respuesta incluya un appointmentCta, asegúrate de que esté en español primero y que mencione específicamente ${config.calendlyUrl ? `este enlace para reservar: ${config.calendlyUrl}` : `llamar o escribir a ${config.realtorName} directamente`}.`
}

export async function runAIAgent(context: AgentContext): Promise<void> {
  const config = await getAIConfig()
  const { contact, trigger, property } = context

  const systemPrompt = buildSystemPrompt(config)

  const contactInfo = `
Nombre del cliente: ${contact.firstName} ${contact.lastName}
Estado: ${contact.status}
Lead Score: ${contact.leadScore}/100
Presupuesto: ${contact.buyerBudgetMin ? `$${contact.buyerBudgetMin.toLocaleString()} - $${contact.buyerBudgetMax?.toLocaleString()}` : "no especificado"}
Área de interés: ${contact.buyerLocation || "no especificada"}
Habitaciones mínimas: ${contact.buyerBedroomsMin || "no especificado"}
Email: ${contact.email || "no disponible"}
Teléfono: ${contact.phone || "no disponible"}`

  const bookingCta = config.calendlyUrl
    ? `Reserva aquí: ${config.calendlyUrl}`
    : `Llama o escribe a ${config.realtorName} directamente`

  let userMessage = ""

  switch (trigger) {
    case "NEW_LEAD":
      userMessage = `Acaba de registrarse un nuevo lead: ${contact.firstName} ${contact.lastName}.
${contactInfo}

Genera:
1. Un SMS de bienvenida cálido en español (luego inglés separado por "|"), invitándolo a conectar con Catherine y agendando una cita. Incluye: "${bookingCta}"
2. Un email de bienvenida que:
   - Lo salude por su nombre
   - Le presente a ${config.realtorName} y sus servicios
   - Haga 2-3 preguntas de pre-calificación (presupuesto, área, habitaciones)
   - Invite a agendar una llamada gratuita de 15 minutos
   - Incluya el enlace de citas si disponible
3. Una tarea para Catherine: "Llamar a ${contact.firstName} en las próximas 2 horas"
4. Si el lead es potencialmente comprador de primera vez, marca preQualFirstTime como true`
      break

    case "PRE_QUALIFY":
      userMessage = `${contact.firstName} necesita ser pre-calificado.
${contactInfo}

Genera las primeras preguntas de pre-calificación de manera conversacional y amigable.
Usa estas preguntas clave: presupuesto, área, habitaciones, primera vez comprando, pre-aprobación.
Asegúrate de invitar a agendar una llamada con Catherine: "${bookingCta}"
Sé breve y amigable, no hagas todas las preguntas a la vez.`
      break

    case "PROPERTY_SAVED":
      userMessage = `${contact.firstName} guardó esta propiedad: ${property?.address}, ${property?.city}, ${property?.state} — $${property?.price.toLocaleString()}, ${property?.bedrooms} hab/${property?.bathrooms} baños, ${property?.sqft?.toLocaleString()} pie².
${contactInfo}

Genera:
1. SMS personalizado de seguimiento (≤160 chars, español | inglés): menciona la propiedad, pregunta si quiere verla, invita a agendar visita.
2. Email de seguimiento: describe la propiedad, por qué podría ser perfecta, invita a una visita privada con Catherine. "${bookingCta}"
3. Tarea para Catherine: ver esta propiedad con ${contact.firstName}.`
      break

    case "PROPERTY_VIEWED_3X":
      userMessage = `${contact.firstName} ha visto esta propiedad 3+ veces: ${property?.address}, ${property?.city} — $${property?.price.toLocaleString()}. Señal fuerte de interés.
${contactInfo}

Genera:
1. SMS urgente pero amigable: valida su interés, ofrece responder preguntas, y agenda una visita. Menciona "${bookingCta}"
2. Tarea de alta prioridad para Catherine de llamar personalmente a este lead hoy.`
      break

    case "SEARCH_BEHAVIOR":
      userMessage = `${contact.firstName} ha realizado ${context.recentSearches} búsquedas activas con estos criterios: ${JSON.stringify(context.searchCriteria)}.
${contactInfo}

Genera:
1. SMS alertándolo de nuevas propiedades que coinciden con sus criterios y ofreciendo una llamada con Catherine.
2. Tarea para Catherine de preparar una lista personalizada de propiedades para este cliente.`
      break

    case "FOLLOW_UP":
      userMessage = `Ha pasado tiempo sin contactar a ${contact.firstName} ${contact.lastName}.
${contactInfo}

Genera:
1. SMS amigable de check-in en español | inglés: pregunta cómo está, si sigue buscando propiedad, invita a reconectar con Catherine. "${bookingCta}"
2. Tarea de seguimiento para Catherine.`
      break

    case "open_house_visit":
      userMessage = `${contact.firstName} ${contact.lastName} visitó nuestra casa abierta${property ? ` en ${property.address}, ${property.city} — $${property.price.toLocaleString()}` : ""}.
${contactInfo}

Genera:
1. SMS de agradecimiento cálido (español | inglés): agradece la visita, pregunta qué le pareció, ofrece responder preguntas.
2. Email de seguimiento: resume la propiedad, menciona puntos fuertes, invita a visita privada. "${bookingCta}"
3. Tarea urgente para Catherine de llamar en las próximas 24 horas.`
      break

    case "APPOINTMENT_REQUEST":
      userMessage = `${contact.firstName} ha mostrado interés en agendar una cita.
${contactInfo}

Genera:
1. SMS confirmando que Catherine estará feliz de reunirse, incluye el enlace de reserva: "${bookingCta}"
2. Email con opciones de horario y detalles de qué esperar en la reunión con Catherine.
3. Tarea para Catherine de confirmar la cita.`
      break
  }

  const responseSchema = `
Responde ÚNICAMENTE con este JSON (sin texto adicional):
{
  "sms": "SMS en español | SMS en inglés (≤160 chars total)",
  "emailSubject": "Asunto en español / English Subject",
  "emailBody": "<html> ... email en español primero, luego inglés ... </html>",
  "taskTitle": "Título de tarea para ${config.realtorName}",
  "taskDescription": "Descripción detallada de la tarea",
  "notificationTitle": "Título corto de notificación para ${config.realtorName}",
  "notificationBody": "Cuerpo de notificación explicando qué hizo el agente y por qué importa este lead",
  "leadScoreChange": 5,
  "appointmentCta": "Texto de llamado a la acción para agendar cita (en español)",
  "preQualFirstTime": false,
  "suggestFTBOPlan": false
}`

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage + responseSchema }],
    })

    const text = response.content[0].type === "text" ? response.content[0].text : ""
    let parsed: any = {}
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
    } catch {
      parsed = {
        sms: `Hola ${contact.firstName}! Soy Sofía, asistente de ${config.realtorName}. ¿Podemos hablar sobre tu búsqueda de propiedad? ${bookingCta}`,
      }
    }

    const executedActions: string[] = []

    // Send SMS
    if (parsed.sms && contact.phone && config.autoRespondSMS) {
      try {
        await sendSMS(contact.phone, parsed.sms)
        executedActions.push("SMS enviado")

        await prisma.sMSMessage.create({
          data: {
            body: parsed.sms,
            fromNumber: process.env.TWILIO_PHONE_NUMBER || "system",
            toNumber: contact.phone,
            direction: "OUTBOUND",
            status: "SENT",
            contactId: contact.id,
          },
        })

        const conv = await prisma.aIConversation.upsert({
          where: { id: `conv-${contact.id}` },
          update: { lastMessage: parsed.sms, updatedAt: new Date() },
          create: { id: `conv-${contact.id}`, contactId: contact.id, channel: "SMS", lastMessage: parsed.sms },
        })

        await prisma.aIMessage.create({
          data: {
            conversationId: conv.id,
            role: "assistant",
            content: parsed.sms,
            channel: "SMS",
            delivered: true,
            deliveredAt: new Date(),
          },
        })
      } catch (e) {
        console.error("SMS send failed:", e)
      }
    }

    // Send Email
    if (parsed.emailSubject && parsed.emailBody && contact.email && config.autoRespondEmail) {
      try {
        await sendEmail({ to: contact.email, subject: parsed.emailSubject, html: parsed.emailBody })
        executedActions.push("Email enviado")

        await prisma.email.create({
          data: {
            subject: parsed.emailSubject,
            body: parsed.emailBody,
            fromAddress: process.env.SMTP_FROM || "sofia@casaicrm.com",
            toAddress: contact.email,
            status: "SENT",
            sentAt: new Date(),
            contactId: contact.id,
          },
        })
      } catch (e) {
        console.error("Email send failed:", e)
      }
    }

    // Create task
    if (parsed.taskTitle) {
      const dueDate = new Date()
      dueDate.setHours(dueDate.getHours() + (config.followUpDelayHours || 2))

      await prisma.task.create({
        data: {
          title: parsed.taskTitle,
          description: parsed.taskDescription || "",
          priority: contact.leadScore >= 70 ? "HIGH" : "MEDIUM",
          type: "FOLLOW_UP",
          contactId: contact.id,
          dueDate,
        },
      })
      executedActions.push(`Tarea creada: ${parsed.taskTitle}`)
    }

    // Auto-enroll in FTBO plan if first-time buyer detected
    if (parsed.suggestFTBOPlan || parsed.preQualFirstTime) {
      try {
        const ftboPlan = await prisma.smartPlan.findFirst({
          where: { name: { contains: "Primera Vez" } },
        })
        if (ftboPlan) {
          const alreadyEnrolled = await prisma.smartPlanEnrollment.findFirst({
            where: { contactId: contact.id, planId: ftboPlan.id },
          })
          if (!alreadyEnrolled) {
            await prisma.smartPlanEnrollment.create({
              data: {
                contactId: contact.id,
                planId: ftboPlan.id,
                status: "ACTIVE",
                nextStepAt: new Date(),
              },
            })
            executedActions.push("Inscrito en plan: Comprador de Primera Vez")
          }
        }
      } catch (e) {
        console.error("FTBO plan enrollment error:", e)
      }
    }

    // Update lead score
    if (parsed.leadScoreChange && parsed.leadScoreChange > 0) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          leadScore: Math.min(100, contact.leadScore + parsed.leadScoreChange),
          lastContacted: new Date(),
        },
      })
    }

    // Activity log
    await prisma.activity.create({
      data: {
        type: "AI_TRIGGERED",
        title: `Agente IA: ${trigger.replace(/_/g, " ").toLowerCase()}`,
        description: executedActions.join(", "),
        contactId: contact.id,
      },
    })

    // Notify Catherine
    await prisma.aINotification.create({
      data: {
        title: parsed.notificationTitle || `Sofía actuó sobre ${contact.firstName} ${contact.lastName}`,
        body: parsed.notificationBody || executedActions.join(". "),
        type: trigger,
        priority: contact.leadScore >= 70 ? "HIGH" : "MEDIUM",
        contactId: contact.id,
        metadata: JSON.stringify({ trigger, property, executedActions, appointmentCta: parsed.appointmentCta }),
      },
    })
  } catch (error) {
    console.error("AI Agent error:", error)
  }
}

export async function getAIConfig() {
  let config = await prisma.aIConfig.findFirst()
  if (!config) {
    config = await prisma.aIConfig.create({
      data: {
        agentName: "Sofia",
        realtorName: "Catherine",
        realtorPhone: process.env.REALTOR_PHONE || "",
        realtorEmail: process.env.REALTOR_EMAIL || "",
        agentPersona: "Eres Sofia, una asistente virtual de bienes raíces amigable y profesional que trabaja para Catherine. Hablas principalmente español.",
      },
    })
  }
  return config
}

export async function chatWithAI(
  messages: { role: "user" | "assistant"; content: string }[],
  contactContext?: string
): Promise<string> {
  const config = await getAIConfig()
  const bookingLink = (config as any).calendlyUrl
    ? `\nEnlace para agendar cita con Catherine: ${(config as any).calendlyUrl}`
    : ""

  const system = `${buildSystemPrompt(config)}
${contactContext ? `\nContexto del contacto:\n${contactContext}` : ""}

INSTRUCCIÓN: Detecta el idioma del último mensaje del cliente. Si es español, responde en español. Si es inglés, responde en inglés. Si hay duda, responde en español primero, luego inglés.

En cada respuesta, cuando sea apropiado, menciona la posibilidad de agendar una cita con Catherine.${bookingLink}`

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system,
    messages,
  })

  return response.content[0].type === "text" ? response.content[0].text : ""
}

// Seed the First-Time Homebuyer educational smart plan in Spanish
export async function seedFirstTimeHomebuyerPlan(userId?: string): Promise<any> {
  const existing = await prisma.smartPlan.findFirst({
    where: { name: "Compradores de Primera Vez — Guía Educativa" },
  })
  if (existing) return existing

  const steps = [
    {
      order: 0,
      type: "EMAIL",
      delay: 0,
      subject: "¡Bienvenido(a) a tu viaje hacia tu primera casa! / Welcome to Your First Home Journey!",
      content: `<div style="font-family:Arial,sans-serif;max-width:600px">
<h2 style="color:#4F46E5">¡Hola {first_name}! 🏠</h2>
<p>¡Felicidades por dar el primer paso hacia tu hogar propio! Soy Sofia, la asistente de Catherine. Vamos a guiarte paso a paso en este emocionante proceso.</p>
<p><strong>¿Qué aprenderás en las próximas semanas?</strong></p>
<ul>
<li>✅ Cómo mejorar tu crédito</li>
<li>✅ El proceso de pre-aprobación</li>
<li>✅ Cómo ahorrar para el pago inicial</li>
<li>✅ Qué buscar en una propiedad</li>
<li>✅ El proceso de cierre</li>
</ul>
<p>Catherine está aquí para ayudarte en cada paso. <a href="{calendly_url}" style="color:#4F46E5">Agenda tu consulta gratuita aquí</a>.</p>
<hr/>
<h2 style="color:#4F46E5">Hello {first_name}! 🏠</h2>
<p>Congratulations on taking your first step toward homeownership! I'm Sofia, Catherine's assistant. We'll guide you through this exciting journey step by step.</p>
</div>`,
    },
    {
      order: 1,
      type: "EMAIL",
      delay: 3,
      subject: "Paso 1: Conoce tu puntaje de crédito / Step 1: Know Your Credit Score",
      content: `<div style="font-family:Arial,sans-serif;max-width:600px">
<h2 style="color:#4F46E5">Tu Crédito es tu Poder 💳</h2>
<p>Hola {first_name}, el primer paso para comprar una casa es conocer tu puntaje de crédito.</p>
<p><strong>¿Qué necesitas saber?</strong></p>
<ul>
<li>📊 Un puntaje de 620+ generalmente califica para préstamos convencionales</li>
<li>📊 Un puntaje de 580+ califica para préstamos FHA (ideal para compradores de primera vez)</li>
<li>💡 Puedes ver tu crédito gratis en AnnualCreditReport.com</li>
</ul>
<p>¿Tienes preguntas sobre tu crédito? Catherine puede conectarte con prestamistas de confianza.</p>
<hr/>
<h2 style="color:#4F46E5">Your Credit is Your Power 💳</h2>
<p>Hi {first_name}, the first step to buying a home is knowing your credit score. A score of 620+ qualifies for conventional loans; 580+ for FHA loans (great for first-time buyers).</p>
</div>`,
    },
    {
      order: 2,
      type: "SMS",
      delay: 5,
      content: "Hola {first_name}! ¿Sabías que puedes obtener hasta $15,000 en asistencia para comprador de primera vez? Catherine te explica cómo 🏠 | Hi! You may qualify for up to $15K in first-time buyer assistance. Catherine can explain!",
    },
    {
      order: 3,
      type: "EMAIL",
      delay: 7,
      subject: "Paso 2: ¿Cuánto necesitas para el pago inicial? / Step 2: How Much Do You Need for a Down Payment?",
      content: `<div style="font-family:Arial,sans-serif;max-width:600px">
<h2 style="color:#4F46E5">El Pago Inicial — Más Fácil de lo que Crees 💰</h2>
<p>Hola {first_name}, uno de los mitos más comunes es que necesitas el 20% de pago inicial. ¡La verdad es que hay opciones mucho más accesibles!</p>
<ul>
<li>🏦 <strong>FHA:</strong> Solo 3.5% de pago inicial con buen crédito</li>
<li>🏦 <strong>Convencional:</strong> Desde 3% para compradores de primera vez</li>
<li>🏦 <strong>VA:</strong> 0% si eres veterano o militar activo</li>
<li>🎁 <strong>Programas de asistencia:</strong> Hasta $25,000 en algunos estados</li>
</ul>
<p>Catherine trabaja con prestamistas especializados en compradores de primera vez. <a href="{calendly_url}" style="color:#4F46E5">Agenda tu consulta gratuita</a> para explorar tus opciones.</p>
<hr/>
<h2 style="color:#4F46E5">Down Payment — More Accessible Than You Think 💰</h2>
<p>Hi {first_name}, you don't need 20% down! FHA loans require as little as 3.5%, and some first-time buyer programs offer up to $25,000 in assistance.</p>
</div>`,
    },
    {
      order: 4,
      type: "TASK",
      delay: 10,
      taskType: "CALL",
      taskTitle: "Llamar a {first_name} — Revisión de Pre-calificación",
      content: "Verificar si el cliente ha revisado su crédito y si tiene preguntas sobre el pago inicial. Ofrecer conectar con prestamistas de confianza.",
    },
    {
      order: 5,
      type: "EMAIL",
      delay: 14,
      subject: "Paso 3: Pre-aprobación — Tu llave maestra / Step 3: Pre-approval — Your Master Key",
      content: `<div style="font-family:Arial,sans-serif;max-width:600px">
<h2 style="color:#4F46E5">La Pre-aprobación te da Poder de Negociación 🔑</h2>
<p>Hola {first_name}, tener una carta de pre-aprobación es como tener una llave maestra — los vendedores te toman más en serio y puedes negociar mejor.</p>
<p><strong>Documentos típicamente necesarios:</strong></p>
<ul>
<li>📄 Últimas 2 declaraciones de impuestos</li>
<li>📄 Últimos 2 meses de estados de cuenta bancarios</li>
<li>📄 Comprobantes de ingreso (últimas 2 quincenas)</li>
<li>📄 Identificación oficial</li>
</ul>
<p>Catherine puede recomendarte prestamistas de confianza que hablan español. <a href="{calendly_url}" style="color:#4F46E5">Agenda una llamada</a> para que te conecte hoy.</p>
<hr/>
<h2 style="color:#4F46E5">Pre-approval Gives You Negotiating Power 🔑</h2>
<p>Hi {first_name}, a pre-approval letter shows sellers you're serious and ready to buy. Catherine can connect you with trusted Spanish-speaking lenders today.</p>
</div>`,
    },
    {
      order: 6,
      type: "SMS",
      delay: 18,
      content: "Hola {first_name}! Ya tienes pre-aprobación? Es el paso más importante 🔑. Catherine puede conectarte con prestamistas de confianza hoy. | Do you have pre-approval? It's the most important step. Catherine can connect you with trusted lenders!",
    },
    {
      order: 7,
      type: "EMAIL",
      delay: 21,
      subject: "Paso 4: Encontrando tu hogar ideal / Step 4: Finding Your Dream Home",
      content: `<div style="font-family:Arial,sans-serif;max-width:600px">
<h2 style="color:#4F46E5">¿Qué buscar en tu primera casa? 🏡</h2>
<p>Hola {first_name}, ahora viene la parte emocionante — ¡buscar tu hogar! Aquí te comparto lo que Catherine recomienda considerar:</p>
<ul>
<li>📍 <strong>Ubicación:</strong> Escuelas, transporte, seguridad del vecindario</li>
<li>🏠 <strong>Estado de la propiedad:</strong> ¿Necesita reparaciones? ¿Qué tan nueva es el techo y los sistemas?</li>
<li>💹 <strong>Valor de reventa:</strong> ¿Está el vecindario en crecimiento?</li>
<li>📐 <strong>Espacio:</strong> ¿Tiene cuartos suficientes para tu familia?</li>
<li>🎯 <strong>Necesidades vs deseos:</strong> Distingue entre lo que es esencial y lo que sería ideal</li>
</ul>
<p>Catherine te ayudará a encontrar propiedades que se ajusten a tu lista. <a href="{calendly_url}" style="color:#4F46E5">Agenda una sesión de búsqueda</a> con ella hoy.</p>
<hr/>
<h2 style="color:#4F46E5">What to Look for in Your First Home 🏡</h2>
<p>Hi {first_name}, location, condition, resale value, and space are key factors. Catherine will help you find properties that match your checklist.</p>
</div>`,
    },
    {
      order: 8,
      type: "TASK",
      delay: 25,
      taskType: "FOLLOW_UP",
      taskTitle: "Enviar lista de propiedades a {first_name}",
      content: "Preparar una lista personalizada de propiedades que se ajusten al presupuesto y área de interés del cliente. Incluir opciones para compradores de primera vez.",
    },
    {
      order: 9,
      type: "EMAIL",
      delay: 30,
      subject: "Paso 5: La oferta y el cierre / Step 5: Making an Offer & Closing",
      content: `<div style="font-family:Arial,sans-serif;max-width:600px">
<h2 style="color:#4F46E5">¡El Paso Final — Hacer una Oferta! 🎉</h2>
<p>Hola {first_name}, cuando encuentres la propiedad perfecta, Catherine te guiará para hacer una oferta competitiva. Aquí un resumen del proceso:</p>
<ol>
<li>✍️ <strong>La oferta:</strong> Catherine negocia en tu nombre para obtener el mejor precio</li>
<li>🔍 <strong>Inspección:</strong> Un inspector revisa la propiedad (muy recomendado)</li>
<li>🏦 <strong>Tasación:</strong> El banco confirma el valor de la propiedad</li>
<li>📝 <strong>Cierre:</strong> Firmas los documentos y ¡recibes las llaves!</li>
</ol>
<p>Los costos de cierre típicamente son del 2-5% del precio de compra. Catherine te explicará cada detalle.</p>
<p><strong>¿Estás listo para empezar tu búsqueda?</strong> <a href="{calendly_url}" style="color:#4F46E5">Agenda tu cita con Catherine hoy</a> — es completamente gratuita.</p>
<hr/>
<h2 style="color:#4F46E5">The Final Step — Making an Offer! 🎉</h2>
<p>Hi {first_name}, Catherine will negotiate on your behalf to get the best price. Closing costs are typically 2-5% of the purchase price. <a href="{calendly_url}">Schedule your free appointment with Catherine</a> to get started!</p>
</div>`,
    },
  ]

  const plan = await prisma.smartPlan.create({
    data: {
      name: "Compradores de Primera Vez — Guía Educativa",
      description: "Plan educativo de 30 días en español para compradores de primera vez. Guía paso a paso: crédito, pago inicial, pre-aprobación, búsqueda y cierre.",
      trigger: "NEW_LEAD",
      isActive: true,
      ...(userId && { userId }),
      steps: {
        create: steps,
      },
    },
    include: { steps: true },
  })

  return plan
}
