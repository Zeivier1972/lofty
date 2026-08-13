export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { prisma } from "@/lib/prisma"
import { sendSMS } from "@/lib/sms"
import { searchIdxListings, buildDisplayAddress, fetchPrimaryPhotos } from "@/lib/bridge"
import { getMatchingPreConstruction } from "@/lib/social-ai-chat"

const APP = process.env.NEXT_PUBLIC_APP_URL || "https://www.catherinegomezrealtor.com"

type Analysis = {
  note: string | null
  listingType: "PRECONSTRUCTION" | "RESALE" | null
  wantsListings: boolean
  prefs: {
    location?: string | null; bedroomsMin?: number | null; bathroomsMin?: number | null
    budgetMin?: number | null; budgetMax?: number | null; timelineMonths?: number | null
    purpose?: string | null; propertyType?: string | null
  }
}

// One structured read of the conversation: profile prefs + whether/what listings
// to show. Drives both the DB write-back and the in-chat listing search.
async function analyzeConversation(anthropic: Anthropic, convo: string): Promise<Analysis | null> {
  try {
    const r = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 450,
      system: `Analiza esta conversación de bienes raíces (Sofía = asistente, Lead = cliente). Devuelve SOLO un JSON válido, sin texto extra:
{"note":"resumen 1-2 frases de qué busca y su situación/objeción","listingType":"PRECONSTRUCTION"|"RESALE"|null,"wantsListings":true|false,"prefs":{"location":string|null,"bedroomsMin":number|null,"bathroomsMin":number|null,"budgetMin":number|null,"budgetMax":number|null,"timelineMonths":number|null,"purpose":"INVERSION"|"VIVIENDA"|null,"propertyType":"CONDO"|"HOUSE"|"TOWNHOUSE"|"PRE_CONSTRUCTION"|"MULTI_FAMILY"|"LAND"|null}}
- listingType: "PRECONSTRUCTION" si busca proyectos nuevos/en planos; "RESALE" si busca propiedades existentes/reventa; null si aún no está claro.
- wantsListings: true solo si el lead pide ver opciones/propiedades o ya dio criterios claros. Presupuestos en dólares (número). null cuando falte el dato. No inventes.`,
      messages: [{ role: "user", content: convo.slice(-4000) }],
    })
    const txt = r.content[0]?.type === "text" ? r.content[0].text : ""
    return JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1)) as Analysis
  } catch {
    return null
  }
}

// Brickell isn't an MLS city — map it (and default) to ZIPs / city for the search.
function locationToSearch(loc?: string | null): { city?: string; zips?: string[] } {
  const l = (loc || "").trim()
  if (!l) return {}
  if (/^\d{5}$/.test(l)) return { zips: [l] }
  if (/brickell/i.test(l)) return { zips: ["33129", "33130", "33131"] }
  return { city: l }
}

async function fetchResaleCards(a: Analysis) {
  try {
    if (!process.env.BRIDGE_SERVER_TOKEN) return []
    const loc = locationToSearch(a.prefs.location)
    const listings = await searchIdxListings({
      ...loc,
      minBeds: a.prefs.bedroomsMin || undefined,
      minPrice: a.prefs.budgetMin || undefined,
      maxPrice: a.prefs.budgetMax || undefined,
      sort: "price_asc",
      limit: 3,
    })
    const keys = listings.map((l: any) => l.ListingKey).filter(Boolean)
    const photos = keys.length ? await fetchPrimaryPhotos(keys).catch(() => ({} as Record<string, string>)) : {}
    return listings.slice(0, 3).map((l: any) => ({
      address: buildDisplayAddress(l),
      city: l.City || "",
      price: l.ListPrice ?? null,
      beds: l.BedroomsTotal ?? null,
      baths: l.BathroomsTotalDecimal ?? null,
      photo: photos[String(l.ListingKey)] || null,
      url: `${APP}/homes/${l.ListingKey}`,
    }))
  } catch {
    return []
  }
}

async function saveProfile(contactId: string, a: Analysis) {
  try {
    const p = a.prefs || {}
    const data: Record<string, unknown> = {}
    if (typeof p.location === "string" && p.location.trim()) data.buyerLocation = p.location.trim()
    if (Number.isFinite(p.bedroomsMin)) data.buyerBedroomsMin = Math.round(p.bedroomsMin as number)
    if (Number.isFinite(p.bathroomsMin)) data.buyerBathroomsMin = p.bathroomsMin
    if (Number.isFinite(p.budgetMin)) data.buyerBudgetMin = p.budgetMin
    if (Number.isFinite(p.budgetMax)) data.buyerBudgetMax = p.budgetMax
    if (Number.isFinite(p.timelineMonths)) data.buyerTimelineMonths = Math.round(p.timelineMonths as number)
    if (typeof p.purpose === "string" && p.purpose) data.buyerPurpose = p.purpose
    if (typeof p.propertyType === "string" && p.propertyType) data.buyerPropertyType = p.propertyType
    if (Object.keys(data).length) await prisma.contact.update({ where: { id: contactId }, data }).catch(() => {})

    if (typeof a.note === "string" && a.note.trim()) {
      const marker = "🗨️ Chat web con Sofía"
      const content = `${marker}\n${a.note.trim()}`
      const existing = await prisma.note.findFirst({ where: { contactId, content: { startsWith: marker } }, orderBy: { createdAt: "desc" } })
      if (existing) await prisma.note.update({ where: { id: existing.id }, data: { content } }).catch(() => {})
      else await prisma.note.create({ data: { contactId, content } }).catch(() => {})
    }
  } catch { /* best-effort */ }
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/

type Msg = { role: "user" | "assistant"; content: string }

// Light lead capture — dedupes by email/phone and links to an existing contact.
// Deliberately does NOT run the full lead-intake automation (welcome SMS/email/
// call), because the visitor is already talking to Sofía right here.
async function captureContact(input: { firstName?: string | null; email?: string | null; phone?: string | null; message?: string }): Promise<string | null> {
  const email = input.email?.trim().toLowerCase() || null
  const phone = input.phone?.replace(/[^\d+]/g, "") || null
  const phoneDigits = phone ? phone.replace(/\D/g, "").slice(-10) : null
  if (!email && !phoneDigits) return null

  let contact = email
    ? await prisma.contact.findFirst({ where: { email: { equals: email, mode: "insensitive" } } }).catch(() => null)
    : phoneDigits
      ? await prisma.contact.findFirst({ where: { phone: { contains: phoneDigits } } }).catch(() => null)
      : null

  const nameParts = (input.firstName || "").trim().split(/\s+/)
  const first = nameParts[0] || "Lead"
  const last = nameParts.slice(1).join(" ") || "Web"

  if (!contact) {
    contact = await prisma.contact.create({
      data: { firstName: first, lastName: last, email: email || undefined, phone: phone || undefined, source: "WEBSITE" },
    }).catch(() => null)
  } else {
    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        email: contact.email || email || undefined,
        phone: contact.phone || phone || undefined,
        ...(input.firstName && (!contact.firstName || contact.firstName === "Lead") ? { firstName: first, lastName: last } : {}),
      },
    }).catch(() => {})
  }
  if (!contact) return null

  const tag = await prisma.tag.upsert({ where: { name: "Chat Web" }, update: {}, create: { name: "Chat Web", color: "#0EA5E9" } }).catch(() => null)
  if (tag) {
    await prisma.contactTag.upsert({
      where: { contactId_tagId: { contactId: contact.id, tagId: tag.id } },
      create: { contactId: contact.id, tagId: tag.id }, update: {},
    }).catch(() => {})
  }
  await prisma.activity.create({
    data: { type: "CHAT", title: "Lead capturado en chat web (Sofía)", description: (input.message || "").slice(0, 200), contactId: contact.id },
  }).catch(() => {})
  return contact.id
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const messages: Msg[] = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-12)
    const pageContext = String(body.pageContext || "").slice(0, 300)
    let contactId: string | null = typeof body.contactId === "string" ? body.contactId : null
    if (!messages.length) return NextResponse.json({ error: "No messages" }, { status: 400 })

    const cfg = await prisma.aIConfig.findFirst()
    const agentName = cfg?.agentName || "Sofía"
    const realtorName = cfg?.realtorName || "Catherine"
    const realtorPhone = cfg?.realtorPhone || "305-283-0872"
    const calendly = cfg?.calendlyUrl || ""
    const bookUrl = calendly || `${process.env.NEXT_PUBLIC_APP_URL || "https://www.catherinegomezrealtor.com"}/book`

    // Known lead? (id arrives from email/portal links)
    let knownName: string | null = null
    if (contactId) {
      const c = await prisma.contact.findUnique({ where: { id: contactId }, select: { firstName: true } }).catch(() => null)
      knownName = c && c.firstName !== "Lead" ? c.firstName : null
      if (!c) contactId = null
    }

    const convo = messages.map(m => m.content).join("\n")
    const email = convo.match(EMAIL_RE)?.[0] || null
    const phone = convo.match(PHONE_RE)?.[0] || null
    const nameMatch = convo.match(/(?:me llamo|mi nombre es|soy|my name is|i am|i'm)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}(?:\s+[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,})?)/i)
    const givenName = nameMatch?.[1]?.trim() || null
    const lastUser = [...messages].reverse().find(m => m.role === "user")?.content || ""

    // Capture once we have contact info and aren't already linked.
    if (!contactId && (email || phone)) {
      contactId = await captureContact({ firstName: knownName || givenName, email, phone, message: lastUser })
      if (!knownName) knownName = givenName
    }

    // Ping Catherine when a captured lead wants to talk/book.
    const wantsCatherine = /hablar|llamar|contactar|catherine|agente|cita|reuni|agenda|schedule|appointment|\bcall\b/i.test(lastUser)
    if (contactId && wantsCatherine && realtorPhone) {
      sendSMS(realtorPhone, `🔔 Lead en el SITIO WEB quiere avanzar\n👤 ${knownName || givenName || "Visitante"}${phone ? `\n📱 ${phone}` : ""}${email ? `\n📧 ${email}` : ""}\n💬 "${lastUser.slice(0, 120)}"`).catch(() => {})
    }

    // Understand the conversation once (prefs + what listings to show).
    const analysis = await analyzeConversation(anthropic, messages.map(m => `${m.role === "user" ? "Lead" : "Sofía"}: ${m.content}`).join("\n"))

    // Fetch listings to show, based on the chosen path.
    let listings: any[] = []
    let projectsUrl: string | null = null
    let listingNote = ""
    if (analysis?.wantsListings && analysis.listingType === "RESALE") {
      listings = await fetchResaleCards(analysis)
      listingNote = listings.length
        ? `Le estás mostrando ${listings.length} propiedades de reventa (resale) en tarjetas abajo del chat. Preséntalas con entusiasmo y pregunta si quiere que ${realtorName} le agende una visita.`
        : `No hay reventa que calce con esos criterios ahora mismo. Dile que ${realtorName} tiene acceso a propiedades exclusivas fuera del mercado y ofrécele agendar una llamada.`
    } else if (analysis?.wantsListings && analysis.listingType === "PRECONSTRUCTION") {
      const pre = await getMatchingPreConstruction(lastUser, calendly, 3).catch(() => [] as string[])
      projectsUrl = `${APP}/new-construction`
      listingNote = pre.length
        ? `Proyectos de preconstrucción relevantes que puedes describir SIN revelar el nombre del desarrollo (empuja a agendar un tour privado con ${realtorName}):\n${pre.join("\n---\n")}`
        : `Invítalo a ver los proyectos de preconstrucción en ${projectsUrl} y a agendar un tour con ${realtorName}.`
    }

    const system = `Eres ${agentName}, la asistente experta de bienes raíces de ${realtorName} Realtor en Miami y Orlando. Chateas con un visitante EN EL SITIO WEB mientras mira propiedades.

MISIÓN: aportar valor real y, cuando el visitante muestre interés, llevarlo a AGENDAR una llamada con ${realtorName}.

CONTEXTO DE LA PÁGINA: ${pageContext || "Explorando el sitio"}
${knownName ? `El visitante es ${knownName} (ya es un lead registrado). Salúdalo por su nombre y NO le pidas de nuevo sus datos.` : "Aún no sabemos quién es."}

PRECONSTRUCCIÓN vs REVENTA — clave para asesorar bien:
- Si aún no sabes qué busca, PREGÚNTALE si le interesa PRECONSTRUCCIÓN (proyectos nuevos, en planos) o REVENTA (propiedades existentes), y explícale la diferencia en 1-2 frases:
  • Preconstrucción: compras hoy al precio de hoy, pagas por etapas durante la obra, entrega a futuro; ideal para plusvalía y menor enganche inicial.
  • Reventa: propiedad existente lista para mudarse o rentar de inmediato; financiamiento tradicional y puedes verla ya.
- Según su objetivo (vivir vs invertir/rentar) recomiéndale la opción que más le conviene y por qué.
${listingNote ? `\nINSTRUCCIÓN PARA ESTE MENSAJE:\n${listingNote}` : ""}

REGLAS:
- Español por defecto (cambia a inglés si te escriben en inglés). Cálida, experta, concisa (2 a 4 oraciones).
- Suena como una asesora experta que da datos útiles, nunca como un bot genérico.
- NUNCA asumas el país del visitante (muchos son de Costa Rica, Colombia, etc.). Refiérete a "tu país" si no lo sabes.
- ${knownName ? "No pidas sus datos otra vez." : `Cuando el visitante esté interesado, pide de forma natural su NOMBRE y WhatsApp para enviarle opciones y que ${realtorName} lo contacte.`}
- No inventes propiedades ni precios; usa solo lo que se te da. Para invertir desde el extranjero, menciona financiamiento para extranjeros (30-40% de enganche, sin ciudadanía) cuando sea relevante.
- Empuja suavemente a agendar y comparte el enlace: ${bookUrl}`

    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })
    const reply = resp.content[0]?.type === "text" ? resp.content[0].text.trim() : "¿En qué te puedo ayudar con tu búsqueda en Miami?"

    if (contactId) {
      prisma.activity.create({
        data: { type: "CHAT", title: "Chat web con Sofía", description: `${lastUser.slice(0, 140)} → ${reply.slice(0, 140)}`, contactId },
      }).catch(() => {})
      // Keep the lead's notes + search preferences up to date from the chat.
      if (analysis) void saveProfile(contactId, analysis)
    }

    return NextResponse.json({ reply, listings, projectsUrl, contactId, bookUrl })
  } catch (e) {
    console.error("[site chat]", e)
    return NextResponse.json({ reply: "Disculpa, tuve un problemita. ¿Puedes repetirlo?", bookUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://www.catherinegomezrealtor.com"}/book` }, { status: 200 })
  }
}
