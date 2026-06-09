export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { sendSMS } from "@/lib/sms"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `Eres Sofía, asistente experta en bienes raíces de Catherine Gomez Realtor en Miami, Florida.

TU MISIÓN: Calificar al lead, encontrar propiedades perfectas para ellos y agendar una cita con Catherine.

PROCESO (sigue este orden naturalmente en la conversación):
1. Saluda calurosamente en el primer mensaje
2. Pregunta qué buscan: ¿comprar, vender o invertir?
3. Califica al lead: presupuesto, área preferida, cuartos, tipo de propiedad
4. Usa search_properties para buscar opciones reales que coincidan
5. Comparte 2-3 propiedades con entusiasmo y detalles clave
6. Cuando haya interés, usa get_appointment_link y empuja para agendar con Catherine
7. Siempre guarda lo que el lead te dice con update_lead_preferences

CUÁNDO BUSCAR PROPIEDADES:
- Tan pronto tengas al menos: precio aproximado O área O número de cuartos
- No esperes tener todos los datos — busca con lo que tengas y refina después
- Si no encuentras resultados, ajusta los filtros y vuelve a buscar

FORMATO DE RESPUESTA PARA SMS:
- Máximo 3 oraciones antes de una pregunta o propiedades
- Para propiedades, usa este formato exacto por cada una:
  🏠 [dirección], [ciudad]
  💰 $[precio] | [cuartos]BR/[baños]BA | [sqft] sqft
  [1 oración sobre por qué es buena opción]
- Después de las propiedades, siempre pregunta: "¿Cuál te llama más la atención?"

PARA AGENDAR CITA:
- Cuando el lead muestre interés en UNA propiedad específica, obtén el link con get_appointment_link
- Di: "¡Perfecto! Catherine puede mostrarte esa propiedad esta semana. Agenda tu cita aquí: [link]"
- Si dicen que quieren verla, insiste amablemente: "Solo toma 2 minutos agendar. Te aseguro que vale la pena."

REGLAS:
- Responde SIEMPRE en español (inglés solo si el lead escribe en inglés)
- Sé cálida, entusiasta — como una amiga experta, no un robot
- Nunca inventes propiedades o precios — solo usa datos reales del sistema
- Si no hay propiedades en la base de datos aún, di que estás buscando y que Catherine les llamará
- Actualiza update_lead_preferences CADA VEZ que el lead comparta información nueva

CATHERINE GOMEZ:
- Experta en Miami con amplia experiencia
- Especialista: Brickell, Miami Beach, Coral Gables, Doral, Kendall, Aventura, Sunny Isles
- Habla español e inglés | Disponible 7 días a la semana`

const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_properties",
    description: "Busca propiedades activas en la base de datos del MLS según los criterios del comprador. Úsala tan pronto tengas algún criterio.",
    input_schema: {
      type: "object" as const,
      properties: {
        price_min: { type: "number", description: "Precio mínimo en dólares" },
        price_max: { type: "number", description: "Precio máximo en dólares" },
        bedrooms_min: { type: "number", description: "Número mínimo de cuartos" },
        location: { type: "string", description: "Ciudad o área: Doral, Brickell, Kendall, Hialeah, Miami Beach, Aventura, Coral Gables, Sunny Isles, Wynwood, etc." },
        property_type: { type: "string", enum: ["CONDO", "SINGLE_FAMILY", "TOWNHOUSE", "MULTI_FAMILY"] },
      },
      required: [],
    },
  },
  {
    name: "get_appointment_link",
    description: "Obtiene el link para que el lead agende una cita o showing con Catherine",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "update_lead_preferences",
    description: "Guarda en el CRM lo que el lead ha compartido sobre sus preferencias y datos de contacto",
    input_schema: {
      type: "object" as const,
      properties: {
        lead_name: { type: "string", description: "Nombre completo si lo mencionó" },
        budget_min: { type: "number", description: "Presupuesto mínimo" },
        budget_max: { type: "number", description: "Presupuesto máximo" },
        bedrooms_min: { type: "number", description: "Cuartos mínimos" },
        location: { type: "string", description: "Área o ciudad preferida" },
        property_type: { type: "string", description: "Tipo de propiedad: CONDO, SINGLE_FAMILY, TOWNHOUSE, MULTI_FAMILY" },
      },
      required: [],
    },
  },
]

async function runTool(name: string, input: any, contactId: string): Promise<string> {
  if (name === "search_properties") {
    try {
      const where: any = { status: "ACTIVE" }

      if (input.price_min != null || input.price_max != null) {
        where.price = {}
        if (input.price_min != null) where.price.gte = input.price_min
        if (input.price_max != null) where.price.lte = input.price_max
      }
      if (input.bedrooms_min != null) where.bedrooms = { gte: input.bedrooms_min }
      if (input.property_type) where.propertyType = input.property_type
      if (input.location) {
        where.OR = [
          { city: { contains: input.location, mode: "insensitive" } },
          { address: { contains: input.location, mode: "insensitive" } },
          { zip: { contains: input.location } },
        ]
      }

      const props = await prisma.property.findMany({
        where,
        take: 3,
        orderBy: { createdAt: "desc" },
        select: { id: true, address: true, city: true, state: true, price: true, bedrooms: true, bathrooms: true, sqft: true, propertyType: true, description: true },
      })

      if (props.length === 0) {
        return "No se encontraron propiedades con esos criterios en este momento. Intenta ajustar el presupuesto o el área."
      }

      return props.map(p =>
        [
          `Dirección: ${p.address}, ${p.city || "Miami"}, ${p.state || "FL"}`,
          `Precio: $${p.price?.toLocaleString() ?? "Consultar"}`,
          `Cuartos: ${p.bedrooms ?? "?"} | Baños: ${p.bathrooms ?? "?"} | Sqft: ${p.sqft?.toLocaleString() ?? "?"}`,
          `Tipo: ${p.propertyType ?? ""}`,
          p.description ? `Descripción: ${p.description.slice(0, 120)}` : "",
        ].filter(Boolean).join("\n")
      ).join("\n---\n")
    } catch (e: any) {
      return "Error al buscar propiedades: " + (e.message || "desconocido")
    }
  }

  if (name === "get_appointment_link") {
    const base = process.env.NEXT_PUBLIC_APP_URL || "https://lofty-production.up.railway.app"
    return `${base}/book`
  }

  if (name === "update_lead_preferences") {
    try {
      const data: any = {}
      if (input.budget_min != null) data.buyerBudgetMin = input.budget_min
      if (input.budget_max != null) data.buyerBudgetMax = input.budget_max
      if (input.bedrooms_min != null) data.buyerBedroomsMin = input.bedrooms_min
      if (input.location) data.buyerLocation = input.location
      if (input.property_type) data.buyerPropertyType = input.property_type
      if (input.lead_name) {
        const parts = input.lead_name.trim().split(/\s+/)
        data.firstName = parts[0]
        if (parts.length > 1) data.lastName = parts.slice(1).join(" ")
      }
      if (Object.keys(data).length > 0) {
        await prisma.contact.update({ where: { id: contactId }, data })
      }
      return "Preferencias guardadas."
    } catch {
      return "No se pudieron guardar las preferencias."
    }
  }

  return "Herramienta no encontrada."
}

export async function POST(req: Request) {
  try {
    const text = await req.text()
    const params = new URLSearchParams(text)
    const from = params.get("From") || params.get("from") || ""
    const body = params.get("Body") || params.get("body") || ""
    const to = params.get("To") || params.get("to") || process.env.TWILIO_PHONE_NUMBER || ""

    if (!from || !body.trim()) {
      return new Response(`<Response></Response>`, { headers: { "Content-Type": "text/xml" } })
    }

    const phone = from.replace("whatsapp:", "").trim()
    const digits = phone.replace(/\D/g, "")

    // Find or create contact
    let contact = await prisma.contact.findFirst({
      where: {
        OR: [
          { phone },
          { phone: `+${digits}` },
          { phone: digits },
          { phone: digits.slice(-10) },
          { phone2: phone },
        ],
      },
      select: {
        id: true, firstName: true, lastName: true, phone: true, status: true,
        buyerBudgetMin: true, buyerBudgetMax: true, buyerBedroomsMin: true,
        buyerLocation: true, buyerPropertyType: true, doNotText: true,
      },
    })

    if (!contact) {
      contact = await prisma.contact.create({
        data: { firstName: "Lead", lastName: phone, phone, status: "LEAD", source: "SMS" },
        select: {
          id: true, firstName: true, lastName: true, phone: true, status: true,
          buyerBudgetMin: true, buyerBudgetMax: true, buyerBedroomsMin: true,
          buyerLocation: true, buyerPropertyType: true, doNotText: true,
        },
      })
    }

    if (contact.doNotText) {
      return new Response(`<Response></Response>`, { headers: { "Content-Type": "text/xml" } })
    }

    const upper = body.trim().toUpperCase()
    if (upper === "STOP" || upper === "UNSUBSCRIBE" || upper === "CANCELAR") {
      await prisma.contact.update({ where: { id: contact.id }, data: { doNotText: true } })
      await prisma.sMSMessage.create({
        data: { body, fromNumber: phone, toNumber: to, direction: "INBOUND", status: "RECEIVED", contactId: contact.id },
      })
      return new Response(`<Response></Response>`, { headers: { "Content-Type": "text/xml" } })
    }

    // Get history before logging new message
    const history = await prisma.sMSMessage.findMany({
      where: { contactId: contact.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    })
    history.reverse()

    await prisma.sMSMessage.create({
      data: { body, fromNumber: phone, toNumber: to, direction: "INBOUND", status: "RECEIVED", contactId: contact.id },
    })

    // Build contact context for Claude
    const isNew = contact.firstName === "Lead"
    const name = isNew ? "Cliente nuevo" : `${contact.firstName} ${contact.lastName}`.trim()
    const ctx: string[] = [`Nombre: ${name}`, `Estado CRM: ${contact.status}`]
    if (contact.buyerBudgetMin || contact.buyerBudgetMax)
      ctx.push(`Presupuesto conocido: $${(contact.buyerBudgetMin || 0).toLocaleString()} – $${(contact.buyerBudgetMax || 0).toLocaleString()}`)
    if (contact.buyerBedroomsMin) ctx.push(`Cuartos mínimos: ${contact.buyerBedroomsMin}`)
    if (contact.buyerLocation) ctx.push(`Área preferida: ${contact.buyerLocation}`)
    if (contact.buyerPropertyType) ctx.push(`Tipo: ${contact.buyerPropertyType}`)
    if (isNew) ctx.push("Nota: aún no tenemos su nombre — pídelo de forma natural.")

    // Build message history
    let msgs: Anthropic.MessageParam[] = [
      ...history.map(m => ({
        role: (m.direction === "INBOUND" ? "user" : "assistant") as "user" | "assistant",
        content: m.body,
      })),
      { role: "user" as const, content: body },
    ]

    // Agentic loop — Claude calls tools until it has a final answer
    let reply = "Hola, soy Sofía de Catherine Gomez Realtor. ¿En qué puedo ayudarte hoy?"
    const MAX = 6

    for (let i = 0; i < MAX; i++) {
      const res = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        system: `${SYSTEM_PROMPT}\n\n---\nCONTEXTO DEL LEAD:\n${ctx.join("\n")}`,
        tools: TOOLS,
        messages: msgs,
      })

      if (res.stop_reason === "end_turn") {
        const t = res.content.find(b => b.type === "text")
        if (t?.type === "text") reply = t.text.trim()
        break
      }

      if (res.stop_reason === "tool_use") {
        msgs = [...msgs, { role: "assistant", content: res.content }]
        const results: Anthropic.ToolResultBlockParam[] = []

        for (const block of res.content) {
          if (block.type === "tool_use") {
            const out = await runTool(block.name, block.input, contact.id)
            results.push({ type: "tool_result", tool_use_id: block.id, content: out })
          }
        }

        msgs = [...msgs, { role: "user", content: results }]
        continue
      }

      // Unexpected stop — grab any text
      const t = res.content.find(b => b.type === "text")
      if (t?.type === "text") reply = t.text.trim()
      break
    }

    // Send reply
    const toNum = phone.startsWith("+") ? phone : `+1${digits.slice(-10)}`
    await sendSMS(toNum, reply)

    await prisma.sMSMessage.create({
      data: { body: reply, fromNumber: to, toNumber: phone, direction: "OUTBOUND", status: "SENT", contactId: contact.id },
    })

    await Promise.all([
      prisma.contact.update({ where: { id: contact.id }, data: { lastContacted: new Date() } }),
      prisma.activity.create({
        data: { type: "SMS", title: "SMS recibido — Sofía respondió", description: body.slice(0, 120), contactId: contact.id },
      }),
    ])

    return new Response(`<Response></Response>`, { headers: { "Content-Type": "text/xml" } })
  } catch (e: any) {
    console.error("[Inbound SMS] Error:", e)
    return new Response(`<Response></Response>`, { headers: { "Content-Type": "text/xml" } })
  }
}
