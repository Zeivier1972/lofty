import Anthropic from "@anthropic-ai/sdk"
import { prisma } from "@/lib/prisma"
import { sendSMS } from "@/lib/sms"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const INTENT_LABELS: Record<string, string> = {
  comprador_vivienda: "comprar para vivir",
  inversionista_airbnb: "invertir / Airbnb",
  solo_explorando: "solo explorando",
}

export interface AIReplyResult {
  reply: string
  sendProperties: boolean
  notifyCatherine: boolean
}

// Keywords that signal the lead wants to see properties
const PROPERTY_KEYWORDS = /casa|casas|propiedad|propiedades|listing|listado|precio|barrio|vecindario|dormitorio|rec[aá]mara|ba[ñn]o|piscina|garage|sq\s?ft|metros|comprar|invertir|airbnb|disponible|ver\s+opcion|mostrar|manda|env[íi]a/i

// Keywords that signal the lead wants to speak with Catherine
const CATHERINE_KEYWORDS = /hablar|llamar|contactar|catherine|agente|cita|reunion|reuni[oó]n|schedule|appointment|call|speak|talk|quiero\s+hablar|puedo\s+llamar|cuando\s+puedo|me\s+llama/i

export async function generateSocialAIReply(
  userMessage: string,
  context: {
    firstName?: string | null
    intent?: string | null
    campaignKeyword?: string | null
    platform: "INSTAGRAM" | "FACEBOOK"
  }
): Promise<AIReplyResult> {
  const [aiConfig, magnet] = await Promise.all([
    prisma.aIConfig.findFirst(),
    context.campaignKeyword
      ? prisma.leadMagnet.findUnique({
          where: { keyword: context.campaignKeyword },
          select: { title: true, description: true },
        }).catch(() => null)
      : Promise.resolve(null),
  ])

  const agentName = aiConfig?.agentName || "Sofía"
  const persona = aiConfig?.agentPersona || "Eres una asistente virtual de bienes raíces amigable y profesional."
  const realtorName = aiConfig?.realtorName || "Catherine"
  const realtorPhone = aiConfig?.realtorPhone || "(305) 283-0872"
  const calendlyUrl = aiConfig?.calendlyUrl || ""
  const platformLabel = context.platform === "INSTAGRAM" ? "Instagram DM" : "Facebook Messenger"

  const topicLine = magnet ? `Tema de interés: "${magnet.title}"${magnet.description ? ` — ${magnet.description}` : ""}` : ""
  const intentLine = context.intent ? `Objetivo declarado: ${INTENT_LABELS[context.intent] || context.intent}` : ""
  const scheduleLine = calendlyUrl ? ` o agendar cita: ${calendlyUrl}` : ""

  const sendProperties = PROPERTY_KEYWORDS.test(userMessage)
  const notifyCatherine = CATHERINE_KEYWORDS.test(userMessage)

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    system: `${persona}

Eres ${agentName}, asistente virtual de ${realtorName} Realtor en Miami. Estás respondiendo por ${platformLabel}.

Datos del lead (ya registrado en el CRM):
- Nombre: ${context.firstName || "cliente"}
${topicLine}
${intentLine}

Reglas:
- Responde de forma natural, cálida y concisa (máx 2-3 oraciones)
- Responde preguntas del mercado inmobiliario de Miami con datos reales y útiles
- Si preguntan por propiedades, di que les estás enviando opciones ahora mismo
- Si quieren hablar con ${realtorName}, confirma que le avisarás${calendlyUrl ? ` y que pueden agendar directo: ${calendlyUrl}` : ""}
- Si quieren avanzar o agendar, dirígelos con ${realtorName}: ${realtorPhone}${scheduleLine}
- NUNCA vuelvas a pedir nombre, email ni teléfono — ya los tenemos
- Responde siempre en español`,
    messages: [{ role: "user", content: userMessage }],
  })

  const reply = response.content[0].type === "text" ? response.content[0].text.trim() : ""
  return { reply, sendProperties, notifyCatherine }
}

// Fetch active property listings filtered by lead intent
export async function getMatchingProperties(intent?: string | null, limit = 3) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ""
  type WhereClause = { status: string; price?: { gte?: number; lte?: number } }
  const where: WhereClause = { status: "ACTIVE" }
  if (intent === "inversionista" || intent === "inversionista_airbnb") {
    where.price = { gte: 300000 }
  } else if (intent === "comprador_vivienda") {
    where.price = { gte: 150000, lte: 1000000 }
  }
  const listings = await prisma.property.findMany({ where, take: limit, orderBy: { createdAt: "desc" } })
  return listings.map(p => {
    const price = p.price.toLocaleString("en-US")
    const details = [
      p.bedrooms != null ? `${p.bedrooms}bd` : null,
      p.bathrooms != null ? `${p.bathrooms}ba` : null,
      p.sqft != null ? `${p.sqft.toLocaleString()} sqft` : null,
    ].filter(Boolean).join(" · ")
    return `🏠 ${p.address}, ${p.city}\n💰 $${price}${details ? `\n🛏 ${details}` : ""}\n🔗 ${appUrl}/site/listing/${p.id}`
  })
}

// Send SMS notification to Catherine about a hot lead wanting to connect
export async function notifyCatherineAboutLead(lead: {
  firstName?: string | null
  phone?: string | null
  email?: string | null
  message: string
  platform: "INSTAGRAM" | "FACEBOOK"
}) {
  const aiConfig = await prisma.aIConfig.findFirst()
  const realtorPhone = aiConfig?.realtorPhone
  if (!realtorPhone) return

  const platformLabel = lead.platform === "INSTAGRAM" ? "Instagram" : "Facebook"
  const sms = [
    `🔔 Lead caliente en ${platformLabel}!`,
    `👤 ${lead.firstName || "Sin nombre"}`,
    lead.phone ? `📱 ${lead.phone}` : null,
    lead.email ? `📧 ${lead.email}` : null,
    `💬 "${lead.message.slice(0, 100)}"`,
    `→ Quiere hablar contigo ahora.`,
  ].filter(Boolean).join("\n")

  await sendSMS(realtorPhone, sms).catch(e => console.error("[AI chat] Catherine SMS notify failed:", e))
}
