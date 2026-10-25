export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { sendSMS, sendWhatsApp, toE164, sanitizeSmsBody } from "@/lib/sms"
import { searchIdxListings, fetchPrimaryPhotos } from "@/lib/bridge"
import { findEventByAdText, findEventByTag, type EventInfo } from "@/lib/events"
import { applyTagAndEnroll } from "@/lib/lead-ingest"
import { appendEventLeadToSheet } from "@/lib/google-sheets"
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
- Si el lead comparte su correo electrónico, guárdalo DE INMEDIATO con update_lead_preferences (junto con su nombre completo si también lo dio). No le pidas el correo a un lead que no viene por un evento.
- Si hay un EVENTO en el contexto del lead y ya te dio nombre y correo: confírmale que le envías las entradas y compártele el link de registro del evento. Si aún falta el correo, pídeselo una sola vez — nunca insistas más de una vez.

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
        email: { type: "string", description: "Correo electrónico si lo compartió (para enviarle entradas, guías o alertas)" },
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

type PropertyCard = { caption: string; imageUrl?: string }
async function runTool(name: string, input: any, contactId: string): Promise<{text: string, imageUrls: string[], cards?: PropertyCard[]}> {
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

      const top = listings.slice(0, 3)
      const photoMap: Record<string, string> = await fetchPrimaryPhotos(top.map((l: any) => l.ListingKey).filter(Boolean)).catch(() => ({}))

      // One card per property — its info + its own photo — so each option is sent
      // as a single MMS (info and image together, not photos dumped at the end).
      // IDX-safe: city/price/specs/MLS# + photo, but NEVER the street address.
      const cards: PropertyCard[] = top.map((l: any, i: number) => {
        const parts = [`Opción ${i + 1}`, `📍 ${l.City || "Miami"}, FL`]
        if (l.ListPrice) parts.push(`💰 $${Number(l.ListPrice).toLocaleString()}`)
        const specs = [l.BedroomsTotal ? `${l.BedroomsTotal} cuartos` : "", l.BathroomsTotalDecimal ? `${l.BathroomsTotalDecimal} baños` : "", l.LivingArea ? `${Number(l.LivingArea).toLocaleString()} sqft` : ""].filter(Boolean).join(" | ")
        if (specs) parts.push(`🏠 ${specs}`)
        if (l.ListingId) parts.push(`🔑 MLS# ${l.ListingId}`)
        // Tap-through to the public IDX detail page (all photos + full info).
        if (l.ListingKey) parts.push(`👉 Ver fotos y detalles: ${appUrl}/homes/${encodeURIComponent(l.ListingKey)}`)
        const img = photoMap[l.ListingKey]
        return { caption: parts.join("\n"), imageUrl: (typeof img === "string" && img.startsWith("http")) ? img : undefined }
      })

      return {
        // The cards are sent as separate MMS messages by the handler, so tell the
        // AI to write ONLY a short intro and NOT re-list the properties itself.
        text: `INSTRUCCIÓN INTERNA: Encontré ${listings.length} propiedades activas del MLS. El sistema las enviará como tarjetas individuales (cada una con su foto) justo después de tu mensaje — así que NO las listes tú. Escribe solo una intro corta y entusiasta (1-2 frases) presentándolas, y al final invita a agendar un tour con Catherine o ver más en ${searchUrl}. NUNCA des direcciones exactas.`,
        imageUrls: [],
        cards,
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
      // Only accept something that actually looks like an address, and never
      // overwrite an email we already hold (a form lead's is more trustworthy
      // than one re-typed into a chat).
      if (input.email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.email.trim())) {
        const current = await prisma.contact.findUnique({ where: { id: contactId }, select: { email: true } })
        if (!current?.email) data.email = input.email.trim().toLowerCase()
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

// Sofía's first reply to a lead arriving from a click-to-WhatsApp ad. This is the
// ONE message a cold ad lead sees, so it names the event and ends with a question.
// Edit the copy here. Only ever used for ad leads (ReferralSourceId present).
function ctwaGreeting(firstName: string, ev?: EventInfo): string {
  const hi = firstName && firstName !== "Lead" ? `¡Hola ${firstName}! 👋` : "¡Hola! 👋"
  if (!ev) {
    return `${hi} Soy Sofía, asistente de Catherine Gómez Realtor. Gracias por escribirnos — te ayudo a invertir en Miami desde Colombia. ¿Qué te gustaría saber?`
  }
  const venue = ev.venue ? ` en ${ev.venue}` : ""
  // Ask for the email in exchange for the tickets — it is the one contact detail
  // an ad lead does not already hand us (WhatsApp gives us their number, and their
  // profile name), and without it they can only ever get SMS event reminders.
  return `${hi} Soy Sofía, asistente de Catherine Gómez Realtor 🏙️\n\nGracias por tu interés en nuestro Evento de Inversión en Miami en ${ev.city} — ${ev.dateLabel}${venue}. La entrada es GRATIS 🎟️ pero los cupos son limitados.\n\nPara enviarte tus entradas, ¿me confirmas tu nombre completo y tu correo electrónico? Tu número de WhatsApp ya lo tengo ✅`
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

    // Meta forwards these ONLY on click-to-WhatsApp ad messages (via Twilio). Also
    // require the WhatsApp channel explicitly, so an SMS lead can never take this
    // path even if a referral field ever showed up on one. For every other inbound
    // message isCtwa is false and nothing below behaves differently than before.
    const referralSourceId = params.get("ReferralSourceId")
    const isCtwa = !!referralSourceId && isWhatsApp
    const ctwaEvent = isCtwa
      ? findEventByAdText(params.get("ReferralHeadline"), params.get("ReferralBody"))
      : undefined

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

    // Ad leads arrive with a WhatsApp profile name; everyone else has none, so the
    // values below stay exactly what they were ("Lead" + phone, SMS/WhatsApp source).
    const ctwaNameParts = isCtwa
      ? (params.get("ProfileName") || "").trim().split(/\s+/).filter(Boolean)
      : []
    let isNewCtwaLead = false

    if (!contact) {
      isNewCtwaLead = isCtwa
      contact = await prisma.contact.create({
        data: {
          firstName: ctwaNameParts[0] || "Lead",
          lastName: ctwaNameParts.length > 1 ? ctwaNameParts.slice(1).join(" ") : phone,
          phone,
          status: "LEAD",
          source: isCtwa ? "FACEBOOK_CTWA" : isWhatsApp ? "WhatsApp" : "SMS",
        },
        select: {
          id: true, firstName: true, lastName: true, phone: true, status: true,
          buyerBudgetMin: true, buyerBudgetMax: true, buyerBedroomsMin: true,
          buyerLocation: true, buyerPropertyType: true, doNotText: true,
          tags: { select: { tag: { select: { name: true } } } },
        },
      })
    }

    // A new click-to-WhatsApp lead needs the same follow-through a form lead gets:
    // the event tag (the reminder cron finds people by tag — untagged means no
    // 7/3/1/0-day countdown), a row on the event sheet, and the ad attribution so
    // we can tell which ad produced them. All best-effort: never block the reply.
    if (isNewCtwaLead) {
      const attribution = [
        "Lead de anuncio click-to-WhatsApp",
        params.get("ReferralHeadline") ? `Anuncio: ${params.get("ReferralHeadline")}` : null,
        `ad_id: ${referralSourceId}`,
        params.get("ReferralCtwaClid") ? `ctwa_clid: ${params.get("ReferralCtwaClid")}` : null,
      ].filter(Boolean).join(" · ")

      prisma.note.create({ data: { content: attribution, contactId: contact.id } }).catch(() => {})

      if (ctwaEvent) {
        applyTagAndEnroll(contact.id, ctwaEvent.tag).catch(e => console.error("[CTWA] tag error:", e))
        appendEventLeadToSheet({
          firstName: contact.firstName,
          lastName: contact.lastName || "",
          phone: contact.phone || phone,
          tags: [ctwaEvent.tag],
        }).catch(() => {})
      }
      console.log(`[CTWA] ad lead ${phone} → contact ${contact.id}${ctwaEvent ? ` (${ctwaEvent.city})` : " (no event matched)"}`)
    }

    if (contact.doNotText) {
      return new Response(`<Response></Response>`, { headers: { "Content-Type": "text/xml" } })
    }

    const upper = body.trim().toUpperCase().replace(/[.!¡]/g, "")
    if (["STOP", "UNSUBSCRIBE", "CANCELAR", "PARAR", "BAJA", "ALTO", "NO MAS", "NO MÁS"].includes(upper)) {
      await prisma.contact.update({ where: { id: contact.id }, data: { doNotText: true } })
      await prisma.sMSMessage.create({
        data: { body, fromNumber: phone, toNumber: to, direction: "INBOUND", status: "RECEIVED", contactId: contact.id },
      })
      return new Response(`<Response></Response>`, { headers: { "Content-Type": "text/xml" } })
    }

    // Get history before logging new message (use correct table per channel).
    // Keep the window small (6) — fewer input tokens per turn = lower AI cost.
    const historyRaw = isWhatsApp
      ? await prisma.whatsAppMessage.findMany({ where: { contactId: contact.id }, orderBy: { createdAt: "desc" }, take: 6 })
      : await prisma.sMSMessage.findMany({ where: { contactId: contact.id }, orderBy: { createdAt: "desc" }, take: 6 })
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

    // Ring the Bell so Catherine sees the reply even when she isn't watching the
    // timeline. Unread by default → lights the bell badge; it clears when she
    // opens the contact (see contacts/[id]/page.tsx). Best-effort, non-fatal.
    {
      const who = contact.firstName && contact.firstName !== "Lead"
        ? `${contact.firstName} ${contact.lastName || ""}`.trim()
        : (contact.phone || phone)
      const channelLabel = isWhatsApp ? "WhatsApp" : "texto"
      prisma.aINotification.create({
        data: {
          type: "LEAD_REPLY",
          title: `💬 ${who} te escribió`,
          body: `Por ${channelLabel}: "${body.slice(0, 160)}"`,
          priority: "HIGH",
          contactId: contact.id,
        },
      }).catch(() => {})
    }

    // Build contact context for Claude
    const isNew = contact.firstName === "Lead"
    const name = isNew ? "Cliente nuevo" : `${contact.firstName} ${contact.lastName}`.trim()
    const tags: string[] = Array.isArray(contact.tags) ? contact.tags.map((ct: any) => ct.tag?.name || "").filter(Boolean) : []
    const isInvestor = tags.some(t => /investor|inversionista/i.test(t))
    const ctx: string[] = [`Nombre: ${name}`, `Estado CRM: ${contact.status}`]
    if (tags.length > 0) ctx.push(`Etiquetas CRM: ${tags.join(", ")}`)
    // A lead tagged for one of Catherine's events: give Sofía the real date, venue
    // and registration link so she can send the tickets instead of inventing details.
    const taggedEvent = tags.map(t => findEventByTag(t)).find(Boolean)
    if (taggedEvent) {
      ctx.push(
        `EVENTO AL QUE ESTE LEAD ESTÁ REGISTRADO/INTERESADO: Evento de Inversión en Miami en ${taggedEvent.city}, ${taggedEvent.dateLabel}` +
        `${taggedEvent.venue ? `, ${taggedEvent.venue}` : ""}. Entrada gratis, cupos limitados. Link de registro: ${taggedEvent.link}` +
        ` — usa SOLO estos datos del evento, nunca inventes fecha, lugar ni link.`
      )
    }
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

    // A brand-new ad lead gets the event greeting instead of a generic AI turn, so
    // they immediately see which event they reached and the ticket link. It is saved
    // to the message history below, so Sofía has that context on every later message
    // — from their second message on, this is null and the normal loop runs.
    const ctwaWelcome = isNewCtwaLead ? ctwaGreeting(contact.firstName, ctwaEvent) : null

    // Agentic loop — Claude calls tools until it has a final answer
    let reply = ctwaWelcome || "Hola, soy Sofía de Catherine Gomez Realtor. ¿En qué puedo ayudarte hoy?"
    const collectedImages: string[] = []
    const propertyCards: PropertyCard[] = []
    // Cap the tool-use rounds (4) so a single reply can't rack up many AI calls.
    // The greeting is already written, so skip the loop (and its AI cost) entirely.
    const MAX = ctwaWelcome ? 0 : 4

    for (let i = 0; i < MAX; i++) {
      const res = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        // Shorter replies = fewer output tokens + get the message across faster.
        max_tokens: 400,
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
            if (out.cards?.length) propertyCards.push(...out.cards)
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

    // Send reply on the same channel it came from.
    // COST RULE: ONE outbound message per reply. Property info is folded into
    // a single text (max 3 properties) with at most one photo — each extra
    // SMS/MMS segment costs money, and bursts of 4-5 messages were adding up.
    const toNum = toE164(phone)
    const topCards = propertyCards.slice(0, 3)
    const combined = topCards.length > 0
      ? `${reply}\n\n${topCards.map(c => c.caption).join("\n\n")}`.slice(0, 1500)
      : reply
    const firstPhoto = topCards.find(c => c.imageUrl)?.imageUrl

    if (isWhatsApp) {
      // WhatsApp isn't billed per segment and shows images inline for free, so
      // keep the hero photo + emojis here.
      await sendWhatsApp(toNum, combined, firstPhoto)
      await prisma.whatsAppMessage.create({
        data: { body: combined, fromNumber: to, toNumber: phone, direction: "OUTBOUND", status: "SENT", contactId: contact.id },
      })
    } else {
      // SMS: link-only (no MMS) + GSM-7 sanitized so the whole reply stays a
      // single cheap segment. The per-property link opens the full photo gallery.
      const cheap = sanitizeSmsBody(combined)
      await sendSMS(toNum, cheap)
      await prisma.sMSMessage.create({
        data: { body: cheap, fromNumber: to, toNumber: phone, direction: "OUTBOUND", status: "SENT", contactId: contact.id },
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
