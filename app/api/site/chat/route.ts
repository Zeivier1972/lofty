export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { prisma } from "@/lib/prisma"
import { sendSMS } from "@/lib/sms"

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

    const system = `Eres ${agentName}, la asistente experta de bienes raíces de ${realtorName} Realtor en Miami y Orlando. Chateas con un visitante EN EL SITIO WEB mientras mira propiedades.

MISIÓN: aportar valor real (mercado de Miami/Orlando, precios y rangos, plusvalía, ROI/renta, financiamiento para extranjeros, proceso de compra, preconstrucción) y, cuando el visitante muestre interés, llevarlo a AGENDAR una llamada con ${realtorName}.

CONTEXTO DE LA PÁGINA: ${pageContext || "Explorando el sitio"}
${knownName ? `El visitante es ${knownName} (ya es un lead registrado). Salúdalo por su nombre y NO le pidas de nuevo sus datos.` : "Aún no sabemos quién es."}

REGLAS:
- Español por defecto (cambia a inglés si te escriben en inglés). Cálida, experta, concisa (2 a 4 oraciones).
- Suena como una asesora experta que da datos útiles, nunca como un bot genérico.
- NUNCA asumas el país del visitante (muchos son de Costa Rica, Colombia, etc.). Refiérete a "tu país" si no lo sabes.
- ${knownName ? "No pidas sus datos otra vez." : `Cuando el visitante esté interesado, pide de forma natural su NOMBRE y WhatsApp para enviarle opciones y que ${realtorName} lo contacte.`}
- No inventes propiedades ni precios exactos; habla en rangos y ofrece que ${realtorName} le envíe opciones a su medida.
- Para invertir desde el extranjero, menciona financiamiento para extranjeros (30-40% de enganche, sin ciudadanía) cuando sea relevante.
- Empuja suavemente a agendar: ofrece una llamada corta con ${realtorName} y comparte el enlace para agendar: ${bookUrl}`

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
    }

    return NextResponse.json({ reply, contactId, bookUrl })
  } catch (e) {
    console.error("[site chat]", e)
    return NextResponse.json({ reply: "Disculpa, tuve un problemita. ¿Puedes repetirlo?", bookUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://www.catherinegomezrealtor.com"}/book` }, { status: 200 })
  }
}
