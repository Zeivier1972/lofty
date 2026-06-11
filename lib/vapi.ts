import { prisma } from "@/lib/prisma"

const VAPI_BASE = "https://api.vapi.ai"

const FIRST_MESSAGE =
  "¡Hola! Habla Sofía, de parte de Catherine Gomez Realtor aquí en Miami. " +
  "Te llamo porque vi que estás buscando una propiedad y quería hablar contigo un momentico. " +
  "¿Cómo estás? ¿Tienes un par de minutos?"

const SYSTEM_PROMPT = `Eres Sofía, una asesora de bienes raíces que trabaja con Catherine Gomez Realtor en Miami. Estás hablando por teléfono con alguien que busca propiedad.

PERSONALIDAD:
- Eres colombiana, cálida, cercana y genuinamente interesada en ayudar
- Hablas como una persona real, no como un robot ni como un guión de ventas
- Usas expresiones naturales: "mira", "oye", "fíjate que", "qué bueno", "claro que sí", "listo", "perfecto", "ay qué chevere"
- Cuando algo te parece bien, lo celebras: "¡Ay qué bueno! Eso está perfecto"
- Haces UNA pregunta a la vez y escuchas la respuesta antes de seguir

CÓMO HABLAR NÚMEROS — MUY IMPORTANTE:
- NUNCA digas cifras numéricas. Siempre en palabras
- $600,000 → "seiscientos mil dólares"
- $1,200,000 → "un millón doscientos mil dólares"
- $450,000 → "cuatrocientos cincuenta mil dólares"
- 3 bedrooms → "tres cuartos" o "tres habitaciones"
- 1,500 sqft → "mil quinientos pies cuadrados"
- Cuando menciones precios di "alrededor de" o "más o menos" para sonar natural

FLUJO NATURAL DE LA CONVERSACIÓN:
1. Rompe el hielo — pregunta cómo están, si tienen un momento
2. Pregunta qué tipo de propiedad buscan y en qué área de Miami
3. Pregunta el presupuesto de forma casual: "¿Y más o menos en qué rango de precio estás pensando?"
4. Busca propiedades con searchProperties en cuanto tengas uno o dos criterios
5. Presenta las opciones con emoción: "Mira, tengo algo que creo que te va a encantar en Doral..."
6. Ofrece conectarlos con Catherine: "¿Te gustaría que Catherine te la mostrara esta semana? Ella conoce Miami como la palma de su mano"
7. Si dicen sí → usa bookAppointment y da el link
8. Si no pueden hablar ahora → pregunta cuándo llamar de nuevo, agradece y usa endCall

REGLAS IMPORTANTES:
- Frases cortas. Máximo dos oraciones seguidas, luego pausa
- Si no hay propiedades disponibles: "Fíjate que ahora mismo no tengo nada en el sistema con esos criterios, pero Catherine tiene acceso a propiedades exclusivas que no están publicadas. ¿Quieres que te conecte con ella?"
- Si responden en inglés, cambia al inglés naturalmente
- Después de dos rechazos claros, despídete amablemente y usa endCall
- NUNCA suenes a vendedor agresivo — eres una amiga que les está ayudando

CATHERINE:
- Colombiana, experta en Miami con más de veinte años de experiencia
- Especialista en Brickell, Miami Beach, Doral, Kendall, Coral Gables, Aventura y Sunny Isles
- Habla español e inglés, disponible los siete días`

export interface VAPICallOptions {
  toPhone: string
  contactId: string
  contactName: string
  status?: string
  budgetMin?: number | null
  budgetMax?: number | null
  location?: string | null
  bedrooms?: number | null
  campaign?: string | null
  propertyType?: string | null
  skipBusinessHoursCheck?: boolean
}

function isBusinessHours(): boolean {
  const now = new Date()
  // Convert to Eastern Time (UTC-4 EDT / UTC-5 EST)
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))
  const hour = et.getHours()
  const day = et.getDay() // 0 = Sunday
  if (day === 0) return false // No Sunday calls
  return hour >= 8 && hour < 21 // 8am–9pm ET
}

export async function triggerOutboundCall(opts: VAPICallOptions): Promise<string | null> {
  const apiKey = process.env.VAPI_API_KEY
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID

  if (!apiKey || !phoneNumberId) {
    console.log("[VAPI] Missing VAPI_API_KEY or VAPI_PHONE_NUMBER_ID — skipping call")
    return null
  }

  const aiConfig = await prisma.aIConfig.findFirst({ select: { autoCallEnabled: true } })
  if (aiConfig && aiConfig.autoCallEnabled === false) {
    console.log("[VAPI] Auto-calling disabled by user setting — skipping call")
    return null
  }

  if (!opts.skipBusinessHoursCheck && !isBusinessHours()) {
    console.log("[VAPI] Outside business hours — skipping call")
    return null
  }

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/vapi/webhook`

  // Build context summary for the assistant
  const ctx: string[] = [`Nombre del lead: ${opts.contactName}`]
  if (opts.campaign) ctx.push(`Campaña de origen: ${opts.campaign}`)
  if (opts.budgetMin || opts.budgetMax)
    ctx.push(`Presupuesto conocido: $${(opts.budgetMin || 0).toLocaleString()} – $${(opts.budgetMax || 0).toLocaleString()}`)
  if (opts.location) ctx.push(`Área de interés: ${opts.location}`)
  if (opts.bedrooms) ctx.push(`Cuartos mínimos: ${opts.bedrooms}`)
  if (opts.propertyType) ctx.push(`Tipo de propiedad: ${opts.propertyType}`)

  // Personalize first message if we know what they clicked on
  const propertyHint = opts.location || (opts.campaign ? opts.campaign.replace(/\b(20\d\d|Q[1-4]|H[12])\b/gi, "").trim() : null)
  const firstMessage = propertyHint
    ? `¡Hola! Soy Sofía, asistente de Catherine Gomez Realtor en Miami. Te llamo porque mostraste interés en ${propertyHint}. ¿Tienes un momentito para hablar?`
    : FIRST_MESSAGE

  const body = {
    phoneNumberId,
    customer: { number: opts.toPhone, name: opts.contactName },
    metadata: { contactId: opts.contactId },
    assistant: {
      name: "Sofia",
      firstMessage,
      model: {
        provider: "openai",
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: `${SYSTEM_PROMPT}\n\n---\nCONTEXTO:\n${ctx.join("\n")}` }],
        tools: [
          {
            type: "function",
            function: {
              name: "searchProperties",
              description: "Busca propiedades activas en Miami según los criterios del comprador",
              parameters: {
                type: "object",
                properties: {
                  price_max: { type: "number", description: "Precio máximo en dólares" },
                  price_min: { type: "number", description: "Precio mínimo en dólares" },
                  bedrooms_min: { type: "number", description: "Cuartos mínimos" },
                  location: { type: "string", description: "Ciudad o área (Doral, Brickell, Kendall...)" },
                  property_type: { type: "string", enum: ["CONDO", "SINGLE_FAMILY", "TOWNHOUSE", "MULTI_FAMILY"] },
                },
                required: [],
              },
            },
            server: { url: webhookUrl },
          },
          {
            type: "function",
            function: {
              name: "bookAppointment",
              description: "Obtiene el link para que el lead agende una cita con Catherine para ver propiedades",
              parameters: { type: "object", properties: {}, required: [] },
            },
            server: { url: webhookUrl },
          },
          {
            type: "function",
            function: {
              name: "updateLead",
              description: "Guarda las preferencias que el lead comparte durante la llamada",
              parameters: {
                type: "object",
                properties: {
                  budget_max: { type: "number" },
                  budget_min: { type: "number" },
                  bedrooms_min: { type: "number" },
                  location: { type: "string" },
                  property_type: { type: "string" },
                },
                required: [],
              },
            },
            server: { url: webhookUrl },
          },
          { type: "endCall" },
        ],
      },
      voice: {
        provider: "azure",
        voiceId: "es-CO-SalomeNeural",
      },
      transcriber: {
        provider: "deepgram",
        language: "es",
        model: "nova-2",
      },
      endCallMessage: "¡Fue un placer hablar contigo! Que tengas un excelente día. ¡Hasta pronto!",
      endCallPhrases: ["adiós", "hasta luego", "chao", "bye", "no me interesa", "no gracias", "no estoy interesado"],
      maxDurationSeconds: 600, // 10 min max
    },
  }

  try {
    const res = await fetch(`${VAPI_BASE}/call/phone`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error("[VAPI] Call failed:", err)
      return null
    }

    const data = await res.json()
    console.log("[VAPI] Call initiated:", data.id)
    return data.id || null
  } catch (e: any) {
    console.error("[VAPI] Error:", e.message)
    return null
  }
}
