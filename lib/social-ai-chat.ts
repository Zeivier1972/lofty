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
  sendPreConstruction: boolean
  notifyCatherine: boolean
}

// Keywords that signal the lead wants to see properties
const PROPERTY_KEYWORDS = /casa|casas|propiedad|propiedades|listing|listado|precio|barrio|vecindario|dormitorio|rec[aá]mara|ba[ñn]o|piscina|garage|sq\s?ft|metros|comprar|invertir|airbnb|disponible|ver\s+opcion|mostrar|manda|env[íi]a/i

// Keywords that signal pre-construction / new construction interest
const PRECONSTRUCTION_KEYWORDS = /nuevo|nueva|preconstrucci[oó]n|pre.construcci[oó]n|new construction|builder|construir|off.plan|planos|preventa|estrenar|sin\s+uso|nuevo\s+desarroll|development|entrega|unidades/i

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

  const sendPreConstruction = PRECONSTRUCTION_KEYWORDS.test(userMessage)
  const sendProperties = !sendPreConstruction && PROPERTY_KEYWORDS.test(userMessage)
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
  return { reply, sendProperties, sendPreConstruction, notifyCatherine }
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

// Fetch pre-construction communities — lead-safe: hides builder, community name, and direct URL
export async function getMatchingPreConstruction(userMessage: string, calendlyUrl: string, limit = 3) {
  const row = await prisma.setting.findUnique({ where: { key: "preconstruction_projects" } })
  if (!row) return []
  let projects: any[] = []
  try { projects = JSON.parse(row.value) } catch { return [] }

  // Active only (not completed)
  const active = projects.filter((p: any) => p.status !== "completed")

  // Extract zipcode or area from the user's message for filtering
  const zipMatch = userMessage.match(/\b(3[0-9]{4})\b/)
  const zip = zipMatch?.[1]

  let matched = active
  if (zip) {
    const byZip = active.filter((p: any) => p.zipCode === zip)
    if (byZip.length > 0) matched = byZip
  } else {
    // Try to match city/neighborhood mentioned in the message
    const lower = userMessage.toLowerCase()
    const byArea = active.filter((p: any) =>
      (p.city && lower.includes(p.city.toLowerCase())) ||
      (p.neighborhood && lower.includes(p.neighborhood.toLowerCase()))
    )
    if (byArea.length > 0) matched = byArea
  }

  const selected = matched.slice(0, limit)
  const bookingLine = calendlyUrl ? `\n📅 Tour privado con Catherine: ${calendlyUrl}` : ""

  return selected.map((p: any) => {
    const priceRange = p.priceMin && p.priceMax
      ? `$${p.priceMin.toLocaleString("en-US")} – $${p.priceMax.toLocaleString("en-US")}`
      : p.priceMin ? `Desde $${p.priceMin.toLocaleString("en-US")}` : null

    const statusLabel: Record<string, string> = {
      pre_launch: "Pre-lanzamiento",
      launching: "En lanzamiento",
      under_construction: "En construcción",
      completed: "Completado",
    }

    return [
      `🏗️ Nueva construcción — ${p.neighborhood || p.city}, FL`,
      priceRange ? `💰 ${priceRange}` : null,
      p.bedrooms ? `🛏 ${p.bedrooms}` : null,
      p.deliveryDate ? `📅 Entrega: ${p.deliveryDate}` : null,
      p.downPayment ? `💵 Down payment: ${p.downPayment}` : null,
      p.status ? `🔖 ${statusLabel[p.status] || p.status}` : null,
      p.description ? `✨ ${p.description}` : null,
      `\n🔐 Para conocer el nombre del desarrollo y agendar un tour exclusivo con Catherine (sin costo):${bookingLine}`,
    ].filter(Boolean).join("\n")
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
