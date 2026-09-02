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
- Cuando busques en la web, cita la fuente y la fecha de los datos

BÚSQUEDA EXHAUSTIVA DE PROYECTOS (MUY IMPORTANTE):
- Cuando te pregunten por proyectos disponibles, opciones de inversión, o "qué hay" en una zona/rango de precio, NO respondas solo de memoria: USA la herramienta de búsqueda web.
- Haz VARIAS búsquedas en la misma respuesta para ser exhaustivo, no una sola. Por ejemplo, busca por: (a) cada vecindario relevante ("preconstruction condos Brickell 2026", "new developments Edgewater", "Doral preconstruction"), (b) el rango de precio del lead, (c) por desarrollador, y (d) "new preconstruction Miami" en general.
- Combina los resultados de todas las búsquedas + el portafolio de Catherine + tu conocimiento en UNA lista completa. Marca claramente cuáles son del portafolio de Catherine.
- Si una búsqueda no da resultados, reformula y vuelve a intentar con otros términos antes de rendirte.
- Presenta los proyectos en una tabla (nombre, zona, desarrollador, precio desde, entrega, ROI estimado, fuente) y sé claro sobre qué datos son actuales (de la web) vs rangos generales del mercado.`

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
  // Extensive search by default: "advanced" depth + more results. Domains are
  // configurable (comma-separated) so Catherine can add sources without a code
  // change; leave TAVILY_INCLUDE_DOMAINS empty to search the whole web.
  const depth = process.env.TAVILY_SEARCH_DEPTH || "advanced"
  const maxResults = Number(process.env.TAVILY_MAX_RESULTS || 12)
  const domainsRaw = process.env.TAVILY_INCLUDE_DOMAINS ?? "preconstruction.miami"
  const includeDomains = domainsRaw.split(",").map(d => d.trim()).filter(Boolean)
  try {
    const resp = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: depth,
        max_results: maxResults,
        include_answer: true,
        ...(includeDomains.length ? { include_domains: includeDomains } : {}),
      }),
    })
    if (!resp.ok) return `Search unavailable (status ${resp.status})`
    const data = await resp.json()
    const results: any[] = data.results || []
    if (results.length === 0) return `No results found for "${query}". Try a broader query or a different neighborhood/price range.`
    const answer = data.answer ? `RESUMEN: ${data.answer}\n\n` : ""
    return answer + results
      .map(r => `**${r.title}**\nURL: ${r.url}\n${r.content?.slice(0, 900) || ""}`)
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
        // Catherine's own inventory is AUTHORITATIVE and often includes off-market
        // projects that are NOT online yet — the advisor can't find these via web
        // search, so give it the full detail she entered on the Pre-Construction
        // page and tell it to prioritize + quote these accurately.
        contextLines.push(`\nPROYECTOS EN CARTERA DE CATHERINE (fuente autoritativa — incluye proyectos exclusivos/off-market que NO están en línea todavía; priorízalos y cita sus datos con exactitud):`)
        projects.slice(0, 40).forEach(p => {
          const header = `${p.name}${(p.neighborhood || p.city) ? ` (${[p.neighborhood, p.city].filter(Boolean).join(", ")})` : ""}`
          const priceRange = (p.priceMin || p.priceMax)
            ? `Precio: ${p.priceMin ? `$${Number(p.priceMin).toLocaleString()}` : "?"}${p.priceMax ? ` – $${Number(p.priceMax).toLocaleString()}` : "+"}`
            : ""
          const details = [
            p.developer ? `Desarrollador: ${p.developer}` : "",
            priceRange,
            p.bedrooms ? `Recámaras: ${p.bedrooms}` : "",
            p.propertyType ? `Tipo: ${p.propertyType}` : "",
            p.deliveryDate ? `Entrega: ${p.deliveryDate}` : "",
            p.estimatedROI ? `ROI estimado: ${p.estimatedROI}` : "",
            p.downPayment ? `Down payment: ${p.downPayment}` : "",
            p.status ? `Estado: ${p.status}` : "",
            p.investmentHighlights ? `Puntos clave: ${p.investmentHighlights}` : "",
            p.description ? `Descripción: ${p.description}` : "",
          ].filter(Boolean).join(" · ")
          contextLines.push(`\n• ${header}\n  ${details}`)
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

  const callOpenAI = (msgs: any[], opts: { stream: boolean; withTools: boolean }) =>
    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: msgs,
        ...(opts.withTools && tools.length ? { tools, tool_choice: "auto" } : {}),
        ...(opts.stream ? { stream: true } : {}),
        temperature: 0.6,
        max_tokens: 2000,
      }),
    })

  async function executeToolCall(tc: any): Promise<string> {
    try {
      if (tc.function.name === "search_web" && tavilyKey) {
        const { query } = JSON.parse(tc.function.arguments || "{}")
        console.log("[Investment Advisor] Tavily search:", query)
        return await tavilySearch(query, tavilyKey)
      }
      if (tc.function.name === "send_email") {
        const { to, subject, body } = JSON.parse(tc.function.arguments || "{}")
        let recipientEmail = to
        if (to === "contact" || !to?.includes("@")) {
          if (!contactId) return "No contact selected and no email address provided. Please specify an email address."
          const c = await prisma.contact.findUnique({ where: { id: contactId }, select: { email: true } }).catch(() => null)
          if (!c?.email) return "No email address found for this contact. Please ask for their email address first."
          recipientEmail = c.email
        }
        const html = wrapEmail(body, { agentName: "Catherine Gómez Realtor" })
        const sent = await sendEmail({ to: recipientEmail, subject, html })
        if (sent && contactId) {
          prisma.activity.create({
            data: { type: "EMAIL_SENT", title: `Investment advisor email: ${subject}`, description: `Sent to ${recipientEmail}: ${subject}`, contactId },
          }).catch(() => {})
        }
        return sent ? `Email sent successfully to ${recipientEmail}` : "Failed to send email — check RESEND_API_KEY in Railway."
      }
    } catch (e: any) {
      return `Tool error: ${e.message}`
    }
    return "Tool not available."
  }

  // Multi-round tool loop: let the model search, read results, and search AGAIN
  // (e.g. several neighborhoods / price bands / developers) before writing its
  // answer, so it surfaces as many projects as possible. Bounded to cap cost.
  const MAX_TOOL_ROUNDS = Number(process.env.ADVISOR_MAX_TOOL_ROUNDS || 3)
  const convo: any[] = [...openaiMessages]

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const resp = await callOpenAI(convo, { stream: false, withTools: tools.length > 0 })
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "")
      console.error("[Investment Advisor] OpenAI error:", errText)
      return NextResponse.json({ error: "OpenAI API error — check OPENAI_API_KEY in Railway" }, { status: 500 })
    }
    const data = await resp.json()
    const choice = data.choices?.[0]

    if (choice?.finish_reason === "tool_calls" && choice.message?.tool_calls?.length) {
      convo.push(choice.message)
      for (const tc of choice.message.tool_calls) {
        const content = await executeToolCall(tc)
        convo.push({ role: "tool", tool_call_id: tc.id, content })
      }
      continue
    }

    // Model answered without needing (more) tools — return its complete answer.
    return simulateSSE(choice?.message?.content || "")
  }

  // Tool budget exhausted while still searching — force a final written answer
  // (streaming, tools off) from everything gathered so far.
  const finalResp = await callOpenAI(convo, { stream: true, withTools: false })
  if (!finalResp.ok) {
    return NextResponse.json({ error: "OpenAI API error on final pass" }, { status: 500 })
  }
  return new Response(finalResp.body, { headers: SSE_HEADERS })
}
