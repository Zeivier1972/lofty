import Anthropic from "@anthropic-ai/sdk"
import { prisma } from "@/lib/prisma"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const INTENT_LABELS: Record<string, string> = {
  comprador_vivienda: "comprar para vivir",
  inversionista_airbnb: "invertir / Airbnb",
  solo_explorando: "solo explorando",
}

export async function generateSocialAIReply(
  userMessage: string,
  context: {
    firstName?: string | null
    intent?: string | null
    campaignKeyword?: string | null
    platform: "INSTAGRAM" | "FACEBOOK"
  }
): Promise<string> {
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

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 280,
    system: `${persona}

Eres ${agentName}, asistente virtual de ${realtorName} Realtor en Miami. Estás respondiendo por ${platformLabel}.

Datos del lead (ya registrado en el CRM):
- Nombre: ${context.firstName || "cliente"}
${topicLine}
${intentLine}

Reglas:
- Responde de forma natural, cálida y concisa (máx 2-3 oraciones)
- Responde preguntas del mercado inmobiliario de Miami con datos reales y útiles
- Si quieren avanzar o agendar, dirígelos con ${realtorName}: ${realtorPhone}${scheduleLine}
- NUNCA vuelvas a pedir nombre, email ni teléfono — ya los tenemos
- Responde siempre en español`,
    messages: [{ role: "user", content: userMessage }],
  })

  return response.content[0].type === "text" ? response.content[0].text.trim() : ""
}
