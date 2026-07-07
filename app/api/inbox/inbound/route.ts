export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { sendSMS, sendWhatsApp } from "@/lib/sms"
import { searchIdxListings, fetchPrimaryPhotos } from "@/lib/bridge"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `Eres Sofía, asistente experta en bienes raíces de Catherine Gomez Realtor en Miami, Florida.

TU MISIÓN: Calificar al lead, encontrar propiedades perfectas para ellos y agendar una cita con Catherine.

PROCESO (sigue este orden naturalmente en la conversación):
1. Saluda calurosamente en el primer mensaje
2. Pregunta qué buscan: ¿comprar, vender o invertir?
3. Califica al lead: presupuesto, área preferida, cuartos, tipo de propiedad
4. Busca propiedades según su interés (ver CUÁNDO USAR CADA BÚSQUEDA abajo)
5. Comparte 2-3 opciones con entusiasmo y detalles clave
6. Cuando haya interés, usa get_appointment_link y empuja para agendar con Catherine
7. Siempre guarda lo que el lead te dice con update_lead_preferences

CUÁNDO USAR CADA BÚSQUEDA:
- search_preconstruction: si el lead es inversionista, menciona pre-construcción, nuevas construcciones, off-plan, planos, preventa, o quiere invertir en desarrollo nuevo. TAMBIÉN úsala si el contexto del lead indica que es inversionista.
- search_properties: para todo lo demás — resale, MLS, propiedades ya construidas, condos existentes, etc.
- Busca tan pronto tengas al menos: precio aproximado O área O cuartos. No esperes todos los datos.

FORMATO DE RESPUESTA PARA SMS:
- Máximo 3 oraciones antes de una pregunta o propiedades
- Para propiedades de pre-construcción:
  🏗 [Ciudad], FL [código postal]
  💰 $[precio] | [cuartos]BR/[baños]BA | [sqft] sqft
  🗓 Entrega: [fecha si disponible]
  [1 frase sobre la oportunidad de inversión]
- Para propiedades MLS:
  🏠 [dirección], [ciudad]
  💰 $[precio] | [cuartos]BR/[baños]BA | [sqft] sqft
  [1 oración sobre por qué es buena opción]
- Después de las propiedades, siempre pregunta: "¿Cuál te llama más la atención?"

PARA AGENDAR CITA:
- Cuando el lead muestre interés en UNA propiedad, obtén el link con get_appointment_link
- Di: "¡Perfecto! Catherine puede darte más detalles exclusivos de esa oportunidad. Agenda aquí: [link]"

REGLAS:
- Responde SIEMPRE en español (inglés solo si el lead escribe en inglés)
- Sé cálida, entusiasta — como una amiga experta, no un robot
- Nunca inventes propiedades o precios — solo usa datos reales del sistema
- Para pre-construcción: NUNCA menciones el nombre del constructor ni la comunidad — solo área, precio, cuartos y entrega
- Si no hay propiedades disponibles, di que estás buscando y que Catherine les llamará
- Actualiza update_lead_preferences CADA VEZ que el lead comparta información nueva

CATHERINE GOMEZ:
- Experta en Miami con amplia experiencia en pre-construcción e inversiones
- Especialista: Brickell, Miami Beach, Coral Gables, Doral, Kendall, Aventura, Sunny Isles, Broward, West Palm Beach
- Habla español e inglés | Disponible 7 días a la semana`

const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_preconstruction",
    description: "Busca propiedades de pre-construcción (nuevas construcciones) disponibles. Úsala cuando: el lead sea inversionista, mencione pre-construcción, nuevas construcciones, off-plan, planos, preventa, o quiera invertir en algo nuevo.",
    input_schema: {
      type: "object" as const,
      properties: {
        city: { type: "string", description: "Ciudad o área: Miami, Homestead, Davie, Fort Lauderdale, Parkland, West Palm Beach" },
        price_max: { type: "number", description: "Presupuesto máximo en dólares" },
        bedrooms_min: { type: "number", description: "Número mínimo de cuartos" },
      },
      required: [],
    },
  },
  {
    name: "search_properties",
    description: "Busca propiedades activas en la base de datos del MLS (ya construidas, resale). Úsala para compradores de vivienda existente — NO para pre-construcción ni inversión en desarrollo nuevo.",
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

async function runTool(name: string, input: any, contactId: string): Promise<{text: string, imageUrls: string[]}> {
  if (name === "search_preconstruction") {
    const noImg: string[] = []
    try {
      const setting = await prisma.setting.findFirst({ where: { key: "preconstruction_scraped" } })
      if (!setting?.value) return {text: "No hay propiedades de pre-construcción disponibles en este momento. Catherine les puede dar información actualizada.", imageUrls: noImg}

      let communities: any[] = []
      try {
        const parsed = JSON.parse(setting.value as string)
        communities = Array.isArray(parsed) ? parsed : (parsed.communities || [])
      } catch { return {text: "No hay datos de pre-construcción disponibles ahora.", imageUrls: noImg} }

      const allCommunities = [...communities]

      const matchCity = (c: any, q: string) =>
        (c.city || "").toLowerCase().includes(q) || (c.area || "").toLowerCase().includes(q)
      const matchPrice = (c: any, max: number) => !c.priceMin || c.priceMin <= max
      const matchBeds = (c: any, min: number) => {
        if (!c.bedrooms) return true
        const bedMin = parseInt(String(c.bedrooms).split("-")[0]) || 0
        return bedMin >= min
      }

      // Exact match: city + price + beds
      let filtered = [...allCommunities]
      if (input.city) filtered = filtered.filter((c: any) => matchCity(c, input.city.toLowerCase()))
      if (input.price_max) filtered = filtered.filter((c: any) => matchPrice(c, input.price_max))
      if (input.bedrooms_min) filtered = filtered.filter((c: any) => matchBeds(c, input.bedrooms_min))

      let fallbackNote = ""

      if (filtered.length === 0 && input.city) {
        // Relax price: show same city at any price
        let sameCity = allCommunities.filter((c: any) => matchCity(c, input.city.toLowerCase()))
        if (input.bedrooms_min) sameCity = sameCity.filter((c: any) => matchBeds(c, input.bedrooms_min))
        if (sameCity.length > 0) {
          filtered = sameCity
          const minPrice = Math.min(...sameCity.map((c: any) => c.priceMin || 0).filter((p: number) => p > 0))
          fallbackNote = `⚠️ No hay opciones en ${input.city} dentro de ese presupuesto. Las opciones disponibles en esa área arrancan desde $${minPrice.toLocaleString()}:\n\n`
        }
      }

      if (filtered.length === 0) {
        // Relax city: show any area within price budget (and beds)
        let withinBudget = [...allCommunities]
        if (input.price_max) withinBudget = withinBudget.filter((c: any) => matchPrice(c, input.price_max))
        if (input.bedrooms_min) withinBudget = withinBudget.filter((c: any) => matchBeds(c, input.bedrooms_min))
        if (withinBudget.length > 0) {
          filtered = withinBudget
          fallbackNote = `⚠️ No hay opciones en ${input.city || "esa área"} con esos criterios. Aquí hay alternativas dentro del presupuesto:\n\n`
        }
      }

      if (filtered.length === 0) {
        const cities = Array.from(new Set(allCommunities.map((c: any) => c.city || c.area).filter(Boolean))).slice(0, 8).join(", ")
        return {text: `No encontré pre-construcciones con esos criterios. Tenemos opciones en: ${cities}. ¿Alguna te interesa?`, imageUrls: noImg}
      }

      const top3 = filtered.slice(0, 3)
      const imageUrls = top3.map((c: any) => c.imageUrl).filter((u: any) => typeof u === "string" && u.startsWith("http"))

      // Return up to 3 — NEVER include builder or community name
      const text = fallbackNote + top3.map((c: any) => {
        const lines: string[] = [`📍 ${c.area || (c.city + ", FL")}`]
        if (c.zipCode) lines[0] += ` · ${c.zipCode}`
        if (c.priceMin) {
          const price = `$${c.priceMin.toLocaleString()}`
          const priceStr = (c.priceMax && c.priceMax !== c.priceMin) ? `${price} – $${c.priceMax.toLocaleString()}` : price
          lines.push(`💰 ${priceStr}`)
        }
        const bedsLine = [c.bedrooms ? `${c.bedrooms} cuartos` : null, c.bathrooms ? `${c.bathrooms} baños` : null, c.sqft ? `${c.sqft.toLocaleString()} sq ft` : null].filter(Boolean).join(" | ")
        if (bedsLine) lines.push(`🏠 ${bedsLine}`)
        if (c.deliveryDate) lines.push(`🗓 Entrega: ${c.deliveryDate}`)
        lines.push("💼 Para detalles exclusivos agenda con Catherine")
        return lines.join("\n")
      }).join("\n\n---\n\n")

      return {text, imageUrls}
    } catch (e: any) {
      return {text: "Error al buscar pre-construcciones: " + (e?.message || "desconocido"), imageUrls: []}
    }
  }

  if (name === "search_properties") {
    // Query LIVE MLS via Bridge and return the actual matching listings so Sofía
    // can share them directly (address, price, beds/baths) — same detail level the
    // agent's manual "Send Properties" panel already sends over SMS/email.
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"
      const searchUrl = `${appUrl}/homes`
      const PT: Record<string, string> = {
        SINGLE_FAMILY: "Single Family Residence", CONDO: "Condominium",
        TOWNHOUSE: "Townhouse", MULTI_FAMILY: "Multi Family",
      }
      const loc = String(input.location || "").trim()
      const tokens = loc ? loc.split(",").map((s: string) => s.trim()).filter(Boolean) : []
      const zips = tokens.filter((t: string) => /^\d{5}$/.test(t))
      const cities = tokens.filter((t: string) => !/^\d{5}$/.test(t))

      const listings = await searchIdxListings({
        zips: zips.length ? zips : undefined,
        cities: cities.length ? cities : undefined,
        minPrice: input.price_min || undefined,
        maxPrice: input.price_max || undefined,
        minBeds: input.bedrooms_min || undefined,
        propertySubType: input.property_type ? PT[input.property_type] : undefined,
        limit: 4,
      })

      if (!listings.length) {
        return {
          text: `INSTRUCCIÓN INTERNA: No hubo coincidencias exactas ahora mismo (el inventario del MLS cambia a diario). NO inventes propiedades. Comparte este enlace para ver todo el inventario activo: ${searchUrl}. Ofrece que Catherine haga una búsqueda personalizada.`,
          imageUrls: [],
        }
      }

      const photoMap: Record<string, string> = await fetchPrimaryPhotos(listings.map((l: any) => l.ListingKey).filter(Boolean)).catch(() => ({}))
      const imageUrls = listings.map((l: any) => photoMap[l.ListingKey]).filter((u: any) => typeof u === "string" && u.startsWith("http")).slice(0, 3)

      // Commission/IDX-safe over SMS: show general area (city), price, specs,
      // and MLS# + photo — but NEVER the street address (the identifying detail).
      const lines = listings.slice(0, 4).map((l: any) => {
        const parts = [`📍 ${l.City || "Miami"}, FL`]
        if (l.ListPrice) parts.push(`💰 $${Number(l.ListPrice).toLocaleString()}`)
        const specs = [l.BedroomsTotal ? `${l.BedroomsTotal} cuartos` : "", l.BathroomsTotalDecimal ? `${l.BathroomsTotalDecimal} baños` : "", l.LivingArea ? `${Number(l.LivingArea).toLocaleString()} sqft` : ""].filter(Boolean).join(" | ")
        if (specs) parts.push(`🏠 ${specs}`)
        if (l.ListingId) parts.push(`🔑 MLS# ${l.ListingId}`)
        return parts.join("\n")
      }).join("\n\n---\n\n")

      return {
        text: `INSTRUCCIÓN INTERNA: Comparte ESTAS propiedades activas del MLS (datos reales en vivo). IMPORTANTE: puedes dar ciudad, precio, cuartos/baños, sqft, número de MLS y la foto, pero NUNCA des la dirección exacta por mensaje — para ver la dirección y todos los detalles el cliente debe usar el sitio: ${searchUrl}. Preséntalas con entusiasmo y ofrece coordinar un tour con Catherine.\n\n${lines}`,
        imageUrls,
      }
    } catch (e: any) {
      return {text: "Error al buscar propiedades: " + (e.message || "desconocido"), imageUrls: []}
    }
  }

  if (name === "get_appointment_link") {
    const base = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"
    return {text: `${base}/book`, imageUrls: []}
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
      return {text: "Preferencias guardadas.", imageUrls: []}
    } catch {
      return {text: "No se pudieron guardar las preferencias.", imageUrls: []}
    }
  }

  return {text: "Herramienta no encontrada.", imageUrls: []}
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

    const isWhatsApp = from.toLowerCase().startsWith("whatsapp:")
    const phone = from.replace(/^whatsapp:/i, "").trim()
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
        tags: { select: { tag: { select: { name: true } } } },
      },
    })

    if (!contact) {
      contact = await prisma.contact.create({
        data: { firstName: "Lead", lastName: phone, phone, status: "LEAD", source: isWhatsApp ? "WhatsApp" : "SMS" },
        select: {
          id: true, firstName: true, lastName: true, phone: true, status: true,
          buyerBudgetMin: true, buyerBudgetMax: true, buyerBedroomsMin: true,
          buyerLocation: true, buyerPropertyType: true, doNotText: true,
          tags: { select: { tag: { select: { name: true } } } },
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

    // Get history before logging new message (use correct table per channel)
    const historyRaw = isWhatsApp
      ? await prisma.whatsAppMessage.findMany({ where: { contactId: contact.id }, orderBy: { createdAt: "desc" }, take: 10 })
      : await prisma.sMSMessage.findMany({ where: { contactId: contact.id }, orderBy: { createdAt: "desc" }, take: 10 })
    historyRaw.reverse()

    if (isWhatsApp) {
      await prisma.whatsAppMessage.create({
        data: { body, fromNumber: phone, toNumber: to, direction: "INBOUND", status: "RECEIVED", contactId: contact.id },
      })
    } else {
      await prisma.sMSMessage.create({
        data: { body, fromNumber: phone, toNumber: to, direction: "INBOUND", status: "RECEIVED", contactId: contact.id },
      })
    }

    // Build contact context for Claude
    const isNew = contact.firstName === "Lead"
    const name = isNew ? "Cliente nuevo" : `${contact.firstName} ${contact.lastName}`.trim()
    const tags: string[] = Array.isArray(contact.tags) ? contact.tags.map((ct: any) => ct.tag?.name || "").filter(Boolean) : []
    const isInvestor = tags.some(t => /investor|inversionista/i.test(t))
    const ctx: string[] = [`Nombre: ${name}`, `Estado CRM: ${contact.status}`]
    if (tags.length > 0) ctx.push(`Etiquetas CRM: ${tags.join(", ")}`)
    if (isInvestor) ctx.push("⚠️ ESTE LEAD ES UN INVERSIONISTA — usa search_preconstruction como primera opción cuando pregunte por propiedades o inversiones.")
    if (contact.buyerBudgetMin || contact.buyerBudgetMax)
      ctx.push(`Presupuesto conocido: $${(contact.buyerBudgetMin || 0).toLocaleString()} – $${(contact.buyerBudgetMax || 0).toLocaleString()}`)
    if (contact.buyerBedroomsMin) ctx.push(`Cuartos mínimos: ${contact.buyerBedroomsMin}`)
    if (contact.buyerLocation) ctx.push(`Área preferida: ${contact.buyerLocation}`)
    if (contact.buyerPropertyType) ctx.push(`Tipo: ${contact.buyerPropertyType}`)
    if (isNew) ctx.push("Nota: aún no tenemos su nombre — pídelo de forma natural.")

    // Build message history
    let msgs: Anthropic.MessageParam[] = [
      ...historyRaw.map(m => ({
        role: (m.direction === "INBOUND" ? "user" : "assistant") as "user" | "assistant",
        content: m.body,
      })),
      { role: "user" as const, content: body },
    ]

    // Agentic loop — Claude calls tools until it has a final answer
    let reply = "Hola, soy Sofía de Catherine Gomez Realtor. ¿En qué puedo ayudarte hoy?"
    const collectedImages: string[] = []
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
            if (out.imageUrls?.length) collectedImages.push(...out.imageUrls)
            results.push({ type: "tool_result", tool_use_id: block.id, content: out.text })
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

    // Send reply on the same channel it came from
    const toNum = phone.startsWith("+") ? phone : `+1${digits.slice(-10)}`
    if (isWhatsApp) {
      await sendWhatsApp(toNum, reply)
      await prisma.whatsAppMessage.create({
        data: { body: reply, fromNumber: to, toNumber: phone, direction: "OUTBOUND", status: "SENT", contactId: contact.id },
      })
      // Send property images as separate messages (up to 3)
      for (const imgUrl of collectedImages.slice(0, 3)) {
        try {
          await sendWhatsApp(toNum, "", imgUrl)
        } catch { /* non-fatal if image fails */ }
      }
    } else {
      await sendSMS(toNum, reply, collectedImages.slice(0, 3))
      await prisma.sMSMessage.create({
        data: { body: reply, fromNumber: to, toNumber: phone, direction: "OUTBOUND", status: "SENT", contactId: contact.id },
      })
    }

    const channel = isWhatsApp ? "WhatsApp" : "SMS"
    await Promise.all([
      prisma.contact.update({ where: { id: contact.id }, data: { lastContacted: new Date() } }),
      prisma.activity.create({
        data: { type: channel, title: `${channel} recibido — Sofía respondió`, description: body.slice(0, 120), contactId: contact.id },
      }),
    ])

    return new Response(`<Response></Response>`, { headers: { "Content-Type": "text/xml" } })
  } catch (e: any) {
    console.error("[Inbound SMS] Error:", e)
    return new Response(`<Response></Response>`, { headers: { "Content-Type": "text/xml" } })
  }
}
