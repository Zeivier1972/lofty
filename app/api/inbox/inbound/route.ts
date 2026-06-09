export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendSMS } from "@/lib/sms"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `Eres Sofía, una asistente experta en bienes raíces en Miami, Florida. Trabajas para Catherine Gomez Realtor.

TU ROL:
- Responder preguntas sobre propiedades en Miami y sus alrededores en español
- Ayudar a compradores y vendedores a entender el mercado
- Calificar leads: entender su presupuesto, área de interés y tipo de propiedad
- Agendar citas con Catherine cuando el cliente esté listo para avanzar

REGLAS IMPORTANTES:
- Responde SIEMPRE en español, salvo que el cliente escriba en inglés (en ese caso responde en inglés)
- Sé cálida, profesional y directa
- Tus respuestas deben ser CORTAS — máximo 2-3 oraciones por SMS
- Nunca inventes precios específicos de propiedades — di que Catherine les puede dar información actualizada
- Si el cliente quiere ver una propiedad o hablar con alguien, ofrece agendar una llamada con Catherine
- Si aún no tienes el nombre del cliente, pídelo de manera natural en la conversación

MERCADO DE MIAMI:
- Áreas populares: Brickell, Miami Beach, Coral Gables, Doral, Kendall, Aventura, Sunny Isles, Wynwood, Coconut Grove
- El mercado incluye condominios, casas unifamiliares, propiedades de inversión y propiedades de lujo
- Miami es un mercado muy dinámico con alta demanda de compradores internacionales y locales
- Los precios varían mucho según el área: desde condos asequibles en Doral hasta mansiones en Miami Beach

CUANDO EL CLIENTE ESTÁ LISTO PARA AVANZAR:
- Pide su nombre completo y correo electrónico
- Ofrece una llamada o reunión con Catherine
- Di: "Te voy a conectar con Catherine directamente para darte la mejor atención personalizada."`

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

    // Find or create contact
    const normalizedPhone = phone.replace(/\D/g, "")
    let contact = await prisma.contact.findFirst({
      where: {
        OR: [
          { phone },
          { phone: `+${normalizedPhone}` },
          { phone: normalizedPhone },
          { phone: normalizedPhone.slice(-10) },
          { phone2: phone },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        buyerBudgetMin: true,
        buyerBudgetMax: true,
        buyerLocation: true,
        buyerPropertyType: true,
        doNotText: true,
      },
    })

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          firstName: "Lead",
          lastName: phone,
          phone,
          status: "LEAD",
          source: "SMS",
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          status: true,
          buyerBudgetMin: true,
          buyerBudgetMax: true,
          buyerLocation: true,
          buyerPropertyType: true,
          doNotText: true,
        },
      })
    }

    // Respect do-not-text opt-out
    if (contact.doNotText) {
      return new Response(`<Response></Response>`, { headers: { "Content-Type": "text/xml" } })
    }

    // Handle STOP / UNSUBSCRIBE
    const upperBody = body.trim().toUpperCase()
    if (upperBody === "STOP" || upperBody === "UNSUBSCRIBE" || upperBody === "CANCELAR") {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { doNotText: true },
      })
      await prisma.sMSMessage.create({
        data: { body, fromNumber: phone, toNumber: to, direction: "INBOUND", status: "RECEIVED", contactId: contact.id },
      })
      return new Response(`<Response></Response>`, { headers: { "Content-Type": "text/xml" } })
    }

    // Get recent conversation history BEFORE logging new message
    const history = await prisma.sMSMessage.findMany({
      where: { contactId: contact.id },
      orderBy: { createdAt: "desc" },
      take: 9,
    })
    history.reverse()

    // Log inbound message
    await prisma.sMSMessage.create({
      data: {
        body,
        fromNumber: phone,
        toNumber: to,
        direction: "INBOUND",
        status: "RECEIVED",
        contactId: contact.id,
      },
    })

    // Build contact context for the AI
    const isNewContact = contact.firstName === "Lead"
    const contactName = isNewContact ? "Cliente nuevo" : `${contact.firstName} ${contact.lastName}`.trim()
    const contextLines = [`Contacto: ${contactName}`, `Estado en CRM: ${contact.status}`]
    if (contact.buyerBudgetMin || contact.buyerBudgetMax) {
      contextLines.push(`Presupuesto: $${(contact.buyerBudgetMin || 0).toLocaleString()} - $${(contact.buyerBudgetMax || 0).toLocaleString()}`)
    }
    if (contact.buyerLocation) contextLines.push(`Área de interés: ${contact.buyerLocation}`)
    if (contact.buyerPropertyType) contextLines.push(`Tipo de propiedad: ${contact.buyerPropertyType}`)
    if (isNewContact) contextLines.push("Nota: No tenemos el nombre de esta persona todavía — pídelo de manera natural si es apropiado.")

    // Build message history for Claude
    const messages: { role: "user" | "assistant"; content: string }[] = [
      ...history.map((msg) => ({
        role: (msg.direction === "INBOUND" ? "user" : "assistant") as "user" | "assistant",
        content: msg.body,
      })),
      { role: "user" as const, content: body },
    ]

    // Call Claude (Haiku for speed)
    const aiResponse = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 250,
      system: `${SYSTEM_PROMPT}\n\n---\nCONTEXTO DEL CONTACTO:\n${contextLines.join("\n")}`,
      messages,
    })

    const replyText =
      aiResponse.content[0].type === "text"
        ? aiResponse.content[0].text.trim()
        : "Hola, gracias por contactarnos. Sofía de Catherine Gomez Realtor. ¿En qué te puedo ayudar?"

    // Send reply
    const toNumber = phone.startsWith("+") ? phone : `+1${normalizedPhone.slice(-10)}`
    await sendSMS(toNumber, replyText)

    // Log outbound AI reply
    await prisma.sMSMessage.create({
      data: {
        body: replyText,
        fromNumber: to,
        toNumber: phone,
        direction: "OUTBOUND",
        status: "SENT",
        contactId: contact.id,
      },
    })

    // Update contact and log activity
    await Promise.all([
      prisma.contact.update({
        where: { id: contact.id },
        data: { lastContacted: new Date() },
      }),
      prisma.activity.create({
        data: {
          type: "SMS",
          title: "SMS recibido — Sofía respondió",
          description: body.slice(0, 120),
          contactId: contact.id,
        },
      }),
    ])

    return new Response(`<Response></Response>`, {
      headers: { "Content-Type": "text/xml" },
    })
  } catch (e: any) {
    console.error("[Inbound SMS] Error:", e)
    return new Response(`<Response></Response>`, {
      headers: { "Content-Type": "text/xml" },
    })
  }
}
