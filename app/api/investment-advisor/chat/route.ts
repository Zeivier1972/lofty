export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendEmail, wrapEmail } from "@/lib/email"

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
}

const SYSTEM_PROMPT = `Eres un asesor experto en inversiones inmobiliarias en Miami y el sur de la Florida. Trabajas con Catherine Gómez Realtor y ayudas a analizar proyectos de preconstrucción, calcular ROI, evaluar vecindarios y asesorar a inversionistas colombianos y latinos.

ÁREAS DE EXPERTISE:
- Proyectos de preconstrucción en Miami: Brickell, Edgewater, Wynwood, Doral, Aventura, Sunny Isles, Miami Beach, Coral Gables
- Cálculo de ROI para alquiler corto plazo (Airbnb) y largo plazo
- Financiamiento para compradores extranjeros: requisitos, bancos, down payment (típicamente 30-50% para no residentes)
- Due diligence: reputación del desarrollador, historial de proyectos, contratos, depósitos en escrow
- Impuestos para extranjeros: FIRPTA, ITIN, implicaciones fiscales en Colombia vs USA
- Mercado de Miami: tendencias, cap rates, vacantes, flujo de turistas
- Estrategias: compra en preconstrucción, asignación de contratos, reventa al completar

DATOS DEL MERCADO MIAMI 2024-2025:
- Cap rate long-term rental: 3-5% Miami Beach/Brickell, 5-7% Doral/Kendall
- Airbnb: 65-80% occupancy en zonas turísticas, $150-$400/noche promedio
- Apreciación anual histórica: 8-12% sur de la Florida
- Down payment extranjeros: 30-50% según banco
- Condo fees lujo: $500-$2,000/mes
- Property tax: ~1-1.5% del valor anual

DESARROLLADORES CLAVE:
- Related Group, Ugo Colombo/CMC Group, OKO Group, Melo Group, Swire Properties, Fortune International, Chateau Group

PROYECTOS EN EL PORTAFOLIO DE CATHERINE (2024-2025):
- River District 14 — Doral, desde $400K, condos en comunidad cerrada
- Millenia Park — Doral/área Mall of the Americas, acceso a amenidades premium
- Twenty-Sixth & Second — Wynwood/Edgewater, unidades boutique en área artística
- Visions — proyecto con enfoque en rentabilidad a corto/largo plazo
- 72 Park — Miami Beach, lujo frente al mar, alta demanda turística
- Waldorf Astoria Residences — Downtown Miami, desde ~$700K, marca icónica
- The Williams — proyecto residencial en zona de alta apreciación
- Edge House — diseño contemporáneo, ideal inversión Airbnb
- Okan Tower — Downtown, uso mixto residencial+hotel, torre icónica
- Nickelodeon Residences — Punta Cana (resort), retorno por alquiler vacacional
- Domus Brickell Center — Brickell, condo-hotel con programa de alquiler gestionado

CAPACIDADES ADICIONALES:
- Genera scripts para WhatsApp listos para copiar y pegar (en español)
- Crea hooks de anuncio para Facebook/Instagram si se te pide
- Usa tablas en markdown para comparar proyectos (columnas: precio, ROI, entrega, down payment, pros/contras)
- Responde en español o inglés según el idioma del usuario
- Puedes buscar proyectos y precios actuales en preconstruction.miami usando la herramienta de búsqueda web

REGLAS:
- Habla en el idioma del usuario (español o inglés)
- Sé directo — Catherine necesita datos accionables para cerrar ventas
- Incluye números: precios, ROI%, plazos, fees, down payment
- Si no tienes datos exactos, usa rangos del mercado y dilo claramente
- Para ROI, muestra el cálculo paso a paso con supuestos claros
- Siempre menciona riesgos relevantes (developer risk, mercado, tipo de cambio)
- Prioriza proyectos del portafolio de Catherine cuando sean relevantes
- Cuando busques en la web, cita la fuente y la fecha de los datos`

const EMAIL_TOOL = {
  type: "function" as const,
  function: {
    name: "send_email",
    description: "Send an email to the selected lead or a specified address with investment information, project details, ROI summaries, or any content from this conversation",
    parameters: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description: "Email address to send to. Use 'contact' to send to the currently selected lead, or provide an explicit email address.",
        },
        subject: {
          type: "string",
          description: "Email subject line",
        },
        body: {
          type: "string",
          description: "Email body in plain HTML. Can include project details, ROI tables, comparisons, WhatsApp scripts, etc.",
        },
      },
      required: ["to", "subject", "body"],
    },
  },
}

const SEARCH_TOOL = {
  type: "function" as const,
  function: {
    name: "search_web",
    description: "Search preconstruction.miami and other Miami real estate sources for current project listings, pricing, availability, and developer info",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query, e.g. 'River District 14 Doral prices' or 'new preconstruction condos Brickell 2025'",
        },
      },
      required: ["query"],
    },
  },
}

async function tavilySearch(query: string, apiKey: string): Promise<string> {
  try {
    const resp = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        include_domains: ["preconstruction.miami"],
        max_results: 5,
      }),
    })
    if (!resp.ok) return `Search unavailable (status ${resp.status})`
    const data = await resp.json()
    const results: any[] = data.results || []
    if (results.length === 0) return "No results found on preconstruction.miami for that query."
    return results
      .map(r => `**${r.title}**\nURL: ${r.url}\n${r.content?.slice(0, 600) || ""}`)
      .join("\n\n---\n\n")
  } catch (e: any) {
    return `Search error: ${e.message}`
  }
}

function simulateSSE(content: string): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: null }] })}\n\n`
        )
      )
      controller.enqueue(encoder.encode("data: [DONE]\n\n"))
      controller.close()
    },
  })
  return new Response(stream, { headers: SSE_HEADERS })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured in Railway. Add it to your Railway environment variables." },
      { status: 503 }
    )
  }

  const tavilyKey = process.env.TAVILY_API_KEY || ""

  const { messages, contactId } = await req.json()
  if (!Array.isArray(messages)) return NextResponse.json({ error: "messages required" }, { status: 400 })

  const contextLines: string[] = []

  if (contactId) {
    try {
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: {
          firstName: true, lastName: true, email: true,
          buyerBudgetMin: true, buyerBudgetMax: true,
          buyerLocation: true, buyerPropertyType: true,
          buyerPurpose: true, buyerTimelineMonths: true, buyerMustHaves: true,
        },
      })
      if (contact) {
        contextLines.push(`LEAD EN ANÁLISIS: ${contact.firstName} ${contact.lastName || ""}${contact.email ? ` (email: ${contact.email})` : ""}`)
        if (contact.buyerBudgetMin || contact.buyerBudgetMax) {
          const min = contact.buyerBudgetMin ? `$${contact.buyerBudgetMin.toLocaleString()}` : "?"
          const max = contact.buyerBudgetMax ? `$${contact.buyerBudgetMax.toLocaleString()}` : "?"
          contextLines.push(`Presupuesto: ${min} – ${max}`)
        }
        if (contact.buyerLocation) contextLines.push(`Área de interés: ${contact.buyerLocation}`)
        if (contact.buyerPropertyType) contextLines.push(`Tipo buscado: ${contact.buyerPropertyType}`)
        if (contact.buyerPurpose) contextLines.push(`Propósito: ${contact.buyerPurpose}`)
        if (contact.buyerTimelineMonths) contextLines.push(`Plazo: ${contact.buyerTimelineMonths} meses`)
        if (contact.buyerMustHaves) contextLines.push(`Must-haves: ${contact.buyerMustHaves}`)
      }
    } catch {}
  }

  try {
    const setting = await prisma.setting.findUnique({ where: { key: "preconstruction_projects" } })
    if (setting) {
      const projects: any[] = JSON.parse(setting.value)
      if (projects.length > 0) {
        contextLines.push(`\nPROYECTOS EN CARTERA DE CATHERINE:`)
        projects.slice(0, 10).forEach(p => {
          const price = p.priceMin ? `desde $${Number(p.priceMin).toLocaleString()}` : ""
          contextLines.push(
            `- ${p.name} (${p.neighborhood || p.city || "Miami"}): ${price}${p.developer ? `, ${p.developer}` : ""}${p.deliveryDate ? `, entrega ${p.deliveryDate}` : ""}${p.estimatedROI ? `, ROI estimado ${p.estimatedROI}` : ""}`
          )
        })
      }
    }
  } catch {}

  const systemContent = contextLines.length > 0
    ? `${SYSTEM_PROMPT}\n\n---\nCONTEXTO ACTUAL:\n${contextLines.join("\n")}`
    : SYSTEM_PROMPT

  const openaiMessages = [
    { role: "system", content: systemContent },
    ...messages.slice(-20),
  ]

  const tools: any[] = [EMAIL_TOOL, ...(tavilyKey ? [SEARCH_TOOL] : [])]

  // Pass 1: non-streaming, detect if web search is needed
  const pass1Resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: openaiMessages,
      ...(tools.length ? { tools, tool_choice: "auto" } : {}),
      temperature: 0.6,
      max_tokens: 1500,
    }),
  })

  if (!pass1Resp.ok) {
    const errText = await pass1Resp.text()
    console.error("[Investment Advisor] OpenAI error:", errText)
    return NextResponse.json({ error: "OpenAI API error — check OPENAI_API_KEY in Railway" }, { status: 500 })
  }

  const pass1Data = await pass1Resp.json()
  const choice = pass1Data.choices?.[0]

  // If the model wants to use a tool, execute it then stream the final answer
  if (choice?.finish_reason === "tool_calls") {
    const toolCalls: any[] = choice.message.tool_calls || []
    const toolResults: any[] = []

    for (const tc of toolCalls) {
      if (tc.function.name === "search_web" && tavilyKey) {
        const { query } = JSON.parse(tc.function.arguments || "{}")
        console.log("[Investment Advisor] Tavily search:", query)
        const results = await tavilySearch(query, tavilyKey)
        toolResults.push({ role: "tool", tool_call_id: tc.id, content: results })
      } else if (tc.function.name === "send_email") {
        const { to, subject, body } = JSON.parse(tc.function.arguments || "{}")
        let recipientEmail = to
        if (to === "contact" || !to?.includes("@")) {
          // Look up contact email
          if (contactId) {
            try {
              const c = await prisma.contact.findUnique({ where: { id: contactId }, select: { email: true, firstName: true } })
              if (c?.email) {
                recipientEmail = c.email
              } else {
                toolResults.push({ role: "tool", tool_call_id: tc.id, content: "No email address found for this contact. Please ask for their email address first." })
                continue
              }
            } catch {
              toolResults.push({ role: "tool", tool_call_id: tc.id, content: "Could not look up contact email." })
              continue
            }
          } else {
            toolResults.push({ role: "tool", tool_call_id: tc.id, content: "No contact selected and no email address provided. Please specify an email address." })
            continue
          }
        }
        try {
          const html = wrapEmail(body, { agentName: "Catherine Gómez Realtor" })
          const sent = await sendEmail({ to: recipientEmail, subject, html })
          toolResults.push({ role: "tool", tool_call_id: tc.id, content: sent ? `Email sent successfully to ${recipientEmail}` : "Failed to send email — check RESEND_API_KEY in Railway." })
        } catch (e: any) {
          toolResults.push({ role: "tool", tool_call_id: tc.id, content: `Email error: ${e.message}` })
        }
      }
    }

    const pass2Resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [...openaiMessages, choice.message, ...toolResults],
        stream: true,
        temperature: 0.6,
        max_tokens: 1500,
      }),
    })

    if (!pass2Resp.ok) {
      return NextResponse.json({ error: "OpenAI API error on tool pass" }, { status: 500 })
    }

    return new Response(pass2Resp.body, { headers: SSE_HEADERS })
  }

  // No tool call — return pass1 content as a simulated SSE stream
  const content = choice?.message?.content || ""
  return simulateSSE(content)
}
