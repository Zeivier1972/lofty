const VAPI_BASE = "https://api.vapi.ai"

const FIRST_MESSAGE =
  "¡Hola! Soy Sofía, asistente de Catherine Gomez Realtor en Miami. " +
  "Te llamo porque recibimos tu información y queremos ayudarte a encontrar tu hogar ideal aquí en Miami. " +
  "¿Tienes un momentito para hablar?"

const SYSTEM_PROMPT = `Eres Sofía, agente virtual de bienes raíces de Catherine Gomez Realtor en Miami, Florida. Estás en una llamada telefónica.

TU OBJETIVO: Calificar al lead y agendar una cita con Catherine para ver propiedades.

FLUJO DE LA LLAMADA:
1. Confirma que tienen un momento para hablar
2. Pregunta si buscan comprar, vender o invertir
3. Para compradores: pregunta presupuesto aproximado, área preferida, cuartos mínimos
4. Usa searchProperties tan pronto tengas algún criterio — no esperes tener todo
5. Menciona 2-3 propiedades con entusiasmo ("Tengo algo perfecto para ti en Doral...")
6. Empuja para agendar cita con Catherine: "¿Te gustaría verla en persona esta semana?"
7. Si dicen que sí → usa bookAppointment para dar el link
8. Si no pueden hablar → pregunta cuándo llamar de nuevo y termina con endCall

REGLAS DE VOZ:
- Habla NATURALMENTE — pausas, frases cortas, como una persona real
- NO uses listas ni bullets — es una conversación hablada
- Después de cada pregunta, espera la respuesta
- Si no hay propiedades disponibles, di que Catherine tiene opciones exclusivas y ofrece la cita directamente
- Habla español. Si el lead responde en inglés, cambia al inglés
- Si claramente no hay interés después de 2 intentos, agradece y termina con endCall

CATHERINE:
- Experta en Miami con muchos años de experiencia
- Áreas: Brickell, Miami Beach, Doral, Kendall, Coral Gables, Aventura, Sunny Isles
- Disponible 7 días, habla español e inglés`

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

  if (!isBusinessHours()) {
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
        voiceId: "es-US-PalomaNeural",
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
