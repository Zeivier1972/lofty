import { prisma } from "@/lib/prisma"

const VAPI_BASE = "https://api.vapi.ai"

const FIRST_MESSAGE =
  "¡Hola! Habla Sofía, de la oficina de Catherine Gómez, asesores de bienes raíces aquí en Miami. " +
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

PRONUNCIACIÓN — habla español natural y claro:
- Pronuncia los nombres en español: "Sofía", "Catherine Gómez"
- No uses palabras en inglés salvo nombres de lugares (Brickell, Doral, Sunny Isles)
- Di "asesora de bienes raíces", nunca "Realtor"

CONFIDENCIALIDAD — NUNCA reveles cómo llegó el lead:
- NUNCA digas "Instagram", "Facebook", "bot", "campaña", "anuncio" ni el nombre de ninguna campaña
- Si en el contexto aparece una campaña como origen, solo úsala para entender qué le interesa
- En vez de eso di cosas naturales: "vi que estás interesado en propiedades en preconstrucción", "me comentaron que estás buscando invertir en Miami"

REGLAS IMPORTANTES:
- Frases cortas. Máximo dos oraciones seguidas, luego pausa
- Si no hay propiedades disponibles: "Fíjate que ahora mismo no tengo nada en el sistema con esos criterios, pero Catherine tiene acceso a propiedades exclusivas que no están publicadas. ¿Quieres que te conecte con ella?"
- Si responden en inglés, cambia al inglés naturalmente
- Después de dos rechazos claros, despídete amablemente y usa endCall
- NUNCA suenes a vendedor agresivo — eres una amiga que les está ayudando

CATHERINE:
- Colombiana, experta en Miami con más de veinte años de experiencia
- Especialista en Brickell, Miami Beach, Doral, Kendall, Coral Gables, Aventura y Sunny Isles
- Habla español e inglés, disponible los siete días

TRANSFERENCIA EN VIVO A CATHERINE:
- Si el lead pide hablar con una persona real, con "la agente", con "Catherine", o dice que prefiere no hablar con una IA → usa la herramienta transferToAgent
- Antes de transferir di: "¡Con mucho gusto! Déjame conectarte con Catherine ahora mismo, un momentico..."
- Solo transfiere si el lead lo pide explícitamente — no lo ofrezcas sin que lo pidan
- SI LA TRANSFERENCIA FALLA O CATHERINE NO CONTESTA: di "Ay, parece que Catherine está ocupada en este momento, pero no te preocupes. ¿Te gustaría que te agendara directamente una cita con ella para que puedan hablar cuando esté disponible?" — y si dicen sí, usa bookAppointment para darle el link`

const DEFAULT_VOICEMAIL_MSG =
  "Hola, soy Sofía, de la oficina de Catherine Gómez, bienes raíces en Miami. Te llamé porque mostraste interés en propiedades y quería platicarte. " +
  "Por favor llámanos al 305-283-0872 o agenda una consulta gratuita en nuestra página web. ¡Que tengas un excelente día! Hasta pronto."

const FIRST_MESSAGE_COLOMBIA = (firstName: string) =>
  `¡Hola, ${firstName}! ¿Cómo está usted? Habla Sofía, de la oficina de Catherine Gómez, asesora inmobiliaria aquí en Miami, Florida. ` +
  `Le llamo porque recientemente mostró interés en invertir en bienes raíces en Florida y quería confirmar que recibió la información que le enviamos. ` +
  `¿Tiene un par de minuticos?`

const SYSTEM_PROMPT_COLOMBIA = `Eres Sofía, asistente de Catherine Gomez Realtor en Miami. Estás llamando a un inversionista colombiano que mostró interés en comprar propiedad en Florida.

OBJETIVO ÚNICO:
Conseguir que agenden una llamada de 30 minutos con Catherine. Ese es tu único trabajo. No trates de vender ahora — ese es el trabajo de Catherine.

PERSONALIDAD:
- Usa "usted" siempre — los colombianos lo prefieren en contextos profesionales
- Cálida y profesional, como asesora financiera de confianza
- Expresiones colombianas: "Con mucho gusto", "Cómo le va", "Qué bueno", "Claro que sí", "Precisamente", "Cómo así"
- NUNCA suenes a vendedora agresiva — eres una experta que les está ayudando

FLUJO DE CONVERSACIÓN:
1. Saludo cálido — verificar si tiene un par de minutos
2. UNA sola pregunta: "¿Está pensando en algo para alquilar como Airbnb, o para uso personal de su familia?"
3. Crear urgencia real: "Catherine tiene propiedades específicas que van con ese perfil y el mercado de Miami se mueve muy rápido"
4. Cierre: "¿Podría hablar con Catherine unos treinta minuticos esta semana? Ella trabaja con colombianos que compran desde allá sin tener que viajar"
5. Ofrecer DOS horarios específicos
6. Si acepta → bookAppointment
7. Si no puede ahora → "¿Y cuándo sería un buen momento? Catherine se acomoda a su horario"

MANEJO DE OBJECIONES — CRÍTICO:
- "No soy ciudadano / no tengo visa" → "Con Catherine no necesita serlo. Colombianos compran en Florida solo con pasaporte. Ella lo ha hecho decenas de veces y le puede explicar exactamente cómo."
- "Es muy complicado desde Colombia" → "Eso es precisamente lo que Catherine facilita. Tiene clientes que compraron desde Bogotá y Medellín sin viajar ni una vez."
- "Mándeme información por WhatsApp" → "Con mucho gusto. Pero para enviarle lo más relevante para usted, Catherine necesita entender su perfil primero. Son solo treinta minuticos, ¿le parece?"
- "No tengo tiempo ahora" → "Claro, ¿y cuándo estaría bien? Catherine se acomoda perfectamente a su horario."
- "Estoy evaluando / pensando" → "Entiendo perfectamente. ¿Qué le haría falta para tomar una decisión? Eso es exactamente lo que Catherine puede responderle en media hora."
- "¿Cuánto dinero necesito?" → "Eso depende de su perfil y objetivos — eso es lo que Catherine le va a aclarar. Hay opciones desde ciento ochenta mil dólares. ¿Hablamos esta semana?"

REGLAS IMPORTANTES:
- Habla siempre en español formal con "usted"
- Frases CORTAS — máximo dos oraciones, luego escuchar
- NUNCA menciones Facebook, Instagram, anuncios, formularios ni campañas
- Después de dos rechazos claros, despídete amablemente y cierra
- Si piden hablar con Catherine directamente → transferToAgent
- Nunca prometas precios ni rendimientos exactos — di "Catherine te explicará los números"
- Los números siempre en palabras: ciento ochenta mil dólares, no $180,000

CATHERINE:
- Colombiana, vive en Miami hace más de veinte años
- Especialista en inversiones para colombianos y latinos en Florida
- Habla español perfectamente, disponible los siete días
- Tiene acceso a propiedades que no están en el mercado público`

const VOICEMAIL_COLOMBIA =
  "Hola, le habla Sofía, de la oficina de Catherine Gómez, asesora inmobiliaria en Miami. Le llamé porque mostró interés en invertir en Florida — " +
  "Catherine tiene información muy relevante para su perfil de inversión. Por favor comuníquese al 305-283-0872 o visítenos en catherinegomezrealtor.com. " +
  "¡Que tenga un excelente día!"

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
  // Manual click-to-call: bypass the auto-call setting and surface real errors
  isManual?: boolean
  // Power dial session fields
  sessionId?: string
  sessionIndex?: number
  voicemailMsg?: string
  investorProfile?: string
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
    if (opts.isManual) throw new Error("VAPI_API_KEY o VAPI_PHONE_NUMBER_ID no están configurados en Railway")
    return null
  }

  const aiConfig = await prisma.aIConfig.findFirst({
    select: { autoCallEnabled: true, realtorPhone: true },
  })
  // The auto-call kill switch only applies to automatic calls, not manual click-to-call
  if (!opts.isManual && aiConfig && aiConfig.autoCallEnabled === false) {
    console.log("[VAPI] Auto-calling disabled by user setting — skipping call")
    return null
  }

  if (!opts.skipBusinessHoursCheck && !isBusinessHours()) {
    console.log("[VAPI] Outside business hours — skipping call")
    return null
  }

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/vapi/webhook`

  // Transfer destination must be E.164 (+1XXXXXXXXXX) or VAPI rejects/fails the transfer
  const realtorPhoneE164 = aiConfig?.realtorPhone
    ? (aiConfig.realtorPhone.startsWith("+")
        ? aiConfig.realtorPhone.replace(/[^\d+]/g, "")
        : `+1${aiConfig.realtorPhone.replace(/\D/g, "").slice(-10)}`)
    : null

  // Build context summary for the assistant
  const ctx: string[] = [`Nombre del lead: ${opts.contactName}`]
  if (opts.campaign) ctx.push(`Campaña de origen: ${opts.campaign}`)
  if (opts.budgetMin || opts.budgetMax)
    ctx.push(`Presupuesto conocido: $${(opts.budgetMin || 0).toLocaleString()} – $${(opts.budgetMax || 0).toLocaleString()}`)
  if (opts.location) ctx.push(`Área de interés: ${opts.location}`)
  if (opts.bedrooms) ctx.push(`Cuartos mínimos: ${opts.bedrooms}`)
  if (opts.propertyType) ctx.push(`Tipo de propiedad: ${opts.propertyType}`)

  // Personalize first message from real interest only — never expose campaign/platform names
  const firstName = opts.contactName.split(" ")[0]
  const isPreCon = opts.propertyType === "PRE_CONSTRUCTION" || /pre.?construcci/i.test(opts.campaign || "")
  const interestHint = opts.location
    ? `propiedades en ${opts.location}`
    : isPreCon
      ? "propiedades en preconstrucción y oportunidades de inversión en Miami"
      : null
  const isColombiaInvestor = opts.investorProfile === "colombia"

  const firstMessage = isColombiaInvestor
    ? FIRST_MESSAGE_COLOMBIA(firstName)
    : interestHint
      ? `¡Hola, ${firstName}! Habla Sofía, de la oficina de Catherine Gómez, asesores de bienes raíces en Miami. Te llamo porque mostraste interés en ${interestHint}. ¿Tienes un momentito para hablar?`
      : `¡Hola, ${firstName}! Habla Sofía, de la oficina de Catherine Gómez, asesores de bienes raíces aquí en Miami. Te llamo porque vi que estás buscando una propiedad y quería hablar contigo un momentico. ¿Cómo estás? ¿Tienes un par de minutos?`

  const vmMsg = opts.voicemailMsg || (isColombiaInvestor ? VOICEMAIL_COLOMBIA : DEFAULT_VOICEMAIL_MSG)

  const body: any = {
    phoneNumberId,
    customer: { number: opts.toPhone, name: opts.contactName },
    metadata: {
      contactId: opts.contactId,
      ...(opts.sessionId && { sessionId: opts.sessionId, sessionIndex: opts.sessionIndex ?? 0 }),
    },
    assistant: {
      // Voicemail detection — leave message and advance to next contact
      voicemailDetection: {
        provider: "twilio",
        enabled: true,
        voicemailDetectionTypes: ["machine_end_beep", "machine_end_silence"],
        machineDetectionTimeout: 30,
      },
      voicemailMessage: vmMsg,
      name: "Sofia",
      firstMessage,
      server: { url: webhookUrl },
      model: {
        provider: "openai",
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: `${isColombiaInvestor ? SYSTEM_PROMPT_COLOMBIA : SYSTEM_PROMPT}\n\n---\nCONTEXTO:\n${ctx.join("\n")}` }],
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
          // Live warm transfer to Catherine when lead explicitly asks for a human
          ...(realtorPhoneE164 ? [{
            type: "transferCall",
            destinations: [{
              type: "phoneNumber",
              number: realtorPhoneE164,
              message: "¡Con mucho gusto! Déjame conectarte con Catherine ahora mismo, un momentico...",
              description: "Transferir la llamada a Catherine Gomez, la agente de bienes raíces en persona",
              transferPlan: {
                // Sofia announces the lead to Catherine before connecting them
                mode: "warm-transfer-say-message",
                message: "Hola Catherine, te transfiero un lead que está en la línea y pidió hablar contigo sobre propiedades.",
              },
            }],
            function: {
              name: "transferToAgent",
              description: "Transfiere la llamada en vivo a Catherine Gomez cuando el lead pide explícitamente hablar con una persona real o con la agente",
            },
          }] : []),
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
      if (opts.isManual) {
        let detail = err
        try {
          const parsed = JSON.parse(err)
          detail = Array.isArray(parsed.message) ? parsed.message.join(", ") : (parsed.message || err)
        } catch {}
        throw new Error(`VAPI: ${detail}`)
      }
      return null
    }

    const data = await res.json()
    console.log("[VAPI] Call initiated:", data.id)
    return data.id || null
  } catch (e: any) {
    console.error("[VAPI] Error:", e.message)
    if (opts.isManual) throw e
    return null
  }
}
