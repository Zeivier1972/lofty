export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

REGLAS:
- Habla en el idioma del usuario (español o inglés)
- Sé directo — Catherine necesita datos accionables para cerrar ventas
- Incluye números: precios, ROI%, plazos, fees, down payment
- Si no tienes datos exactos, usa rangos del mercado y dilo claramente
- Para ROI, muestra el cálculo paso a paso con supuestos claros
- Siempre menciona riesgos relevantes (developer risk, mercado, tipo de cambio)
- NUNCA inventes datos de proyectos no listados arriba
- Prioriza proyectos del portafolio de Catherine cuando sean relevantes`

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

  const { messages, contactId } = await req.json()
  if (!Array.isArray(messages)) return NextResponse.json({ error: "messages required" }, { status: 400 })

  const contextLines: string[] = []

  if (contactId) {
    try {
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: {
          firstName: true, lastName: true,
          buyerBudgetMin: true, buyerBudgetMax: true,
          buyerLocation: true, buyerPropertyType: true,
          buyerPurpose: true, buyerTimelineMonths: true, buyerMustHaves: true,
        },
      })
      if (contact) {
        contextLines.push(`LEAD EN ANÁLISIS: ${contact.firstName} ${contact.lastName || ""}`)
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
          contextLines.push(`- ${p.name} (${p.neighborhood || p.city || "Miami"}): ${price}${p.developer ? `, ${p.developer}` : ""}${p.deliveryDate ? `, entrega ${p.deliveryDate}` : ""}`)
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

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: openaiMessages,
      stream: true,
      temperature: 0.6,
      max_tokens: 1500,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error("[Investment Advisor] OpenAI error:", errText)
    return NextResponse.json({ error: "OpenAI API error — check OPENAI_API_KEY in Railway" }, { status: 500 })
  }

  return new Response(response.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
