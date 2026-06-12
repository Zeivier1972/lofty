export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" })

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { contactId, draft, action } = await req.json()
  if (!contactId || !action) {
    return NextResponse.json({ error: "contactId and action required" }, { status: 400 })
  }

  const [contact, smsMessages, notes] = await Promise.all([
    prisma.contact.findUnique({ where: { id: contactId } }),
    prisma.sMSMessage.findMany({
      where: { contactId },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.note.findMany({
      where: { contactId },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  ])
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const recentMessages = [...smsMessages]
    .reverse()
    .map(m => `${m.direction === "OUTBOUND" ? "Catherine" : contact.firstName}: ${m.body}`)
    .join("\n")

  const contextLines = [
    `Lead: ${contact.firstName} ${contact.lastName || ""}`.trim(),
    `Estado: ${contact.status}`,
    contact.buyerBudgetMax ? `Presupuesto: $${contact.buyerBudgetMax.toLocaleString()}` : "",
    contact.buyerLocation ? `Área de interés: ${contact.buyerLocation}` : "",
    contact.buyerPropertyType ? `Tipo de propiedad: ${contact.buyerPropertyType}` : "",
    notes.length ? `Notas: ${notes.map((n: { content: string }) => n.content).join(" | ")}` : "",
    recentMessages ? `Conversación reciente:\n${recentMessages}` : "",
  ].filter(Boolean).join("\n")

  const agentContext = `Eres la asistente de Catherine Gómez, asesora de bienes raíces en Miami.
Conoces al lead por el siguiente contexto:
${contextLines}`

  let systemPrompt: string
  let userPrompt: string

  if (action === "suggest") {
    systemPrompt = `${agentContext}

Genera 3 mensajes de texto (SMS) cortos, naturales y cálidos que Catherine puede enviar ahora mismo.
Cada mensaje debe tener máximo 160 caracteres, sonar humano, y tener en cuenta el historial.
Si la conversación es en español, escribe en español. Si es en inglés, en inglés.
Devuelve SOLO un arreglo JSON con 3 strings. Sin explicación.`
    userPrompt = "Genera 3 sugerencias de mensaje para enviar ahora."
  } else if (action === "fix") {
    systemPrompt = `${agentContext}

Corrige y mejora el siguiente borrador: ortografía, gramática, tono cálido y profesional.
Mantén el mismo idioma, la misma intención y longitud similar.
Devuelve SOLO un arreglo JSON con 2 versiones mejoradas. Sin explicación.`
    userPrompt = `Borrador a corregir: "${draft}"`
  } else if (action === "translate_en") {
    systemPrompt = `Traduce el siguiente mensaje al inglés conversacional y cálido, apropiado para bienes raíces.
Devuelve SOLO un arreglo JSON con 1 string. Sin explicación.`
    userPrompt = `Traducir al inglés: "${draft}"`
  } else if (action === "translate_es") {
    systemPrompt = `Traduce el siguiente mensaje al español latinoamericano conversacional y cálido, apropiado para bienes raíces.
Devuelve SOLO un arreglo JSON con 1 string. Sin explicación.`
    userPrompt = `Traducir al español: "${draft}"`
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    })

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "[]"
    let suggestions: string[] = []
    try {
      const match = raw.match(/\[[\s\S]*\]/)
      suggestions = match ? JSON.parse(match[0]) : [raw]
    } catch {
      suggestions = [raw]
    }

    return NextResponse.json({ suggestions: suggestions.filter(Boolean) })
  } catch (e: any) {
    console.error("[AI compose-assist]", e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
