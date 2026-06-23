import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const GUIDE_CONFIG: Record<string, {
  keyword: string
  title: string
  subtitle: string
  color: string
  prompt: string
}> = {
  inversion: {
    keyword: "INVERSIÓN",
    title: "Guía de Inversión en Miami 2026",
    subtitle: "Todo lo que necesitas saber para invertir en bienes raíces en South Florida",
    color: "#c9a84c",
    prompt: `Escribe una guía completa de inversión en bienes raíces en Miami para 2026, dirigida a compradores hispanos internacionales (colombianos, venezolanos, cubanos).
Incluye: por qué Miami es la mejor inversión ahora, zonas más rentables (Brickell, Edgewater, Homestead), ROI esperado, cómo comprar sin residencia, proceso paso a paso, errores comunes.
Formato: secciones con títulos <h2>, párrafos <p>, listas <ul><li>.
Tono: Catherine Gomez, experta con 15 años, primera persona, español latinoamericano.
600-800 palabras. Solo el contenido HTML, sin html/body tags.`,
  },
  casa: {
    keyword: "CASA",
    title: "Guía para Compradores de Primera Vez en Miami",
    subtitle: "El camino completo para comprar tu primera casa en South Florida",
    color: "#7c3aed",
    prompt: `Escribe una guía completa para compradores de primera vez en Miami 2026, dirigida a familias hispanas.
Incluye: requisitos de crédito, programas FHA y de ayuda para el down payment en Florida, proceso de compra paso a paso, costos de cierre reales, mejores vecindarios para familias (Doral, Kendall, Miramar), errores más comunes.
Formato: secciones con títulos <h2>, párrafos <p>, listas <ul><li>.
Tono: Catherine Gomez, experta con 15 años, primera persona, español latinoamericano, cálido y educativo.
600-800 palabras. Solo el contenido HTML, sin html/body tags.`,
  },
  gratis: {
    keyword: "GRATIS",
    title: "Reporte del Mercado de Miami 2026",
    subtitle: "El estado actual del mercado inmobiliario en South Florida",
    color: "#0891b2",
    prompt: `Escribe un reporte del mercado inmobiliario de Miami y South Florida para 2026, dirigido a compradores e inversores hispanos.
Incluye: tendencias de precios actuales, inventario disponible, tasas de interés y su impacto, mejores momentos para comprar, predicciones para el resto del año, oportunidades específicas en Brickell, Homestead, Orlando.
Formato: secciones con títulos <h2>, párrafos <p>, listas <ul><li>, incluye datos específicos y porcentajes.
Tono: Catherine Gomez, experta con 15 años, primera persona, español latinoamericano, autoridad y datos reales.
600-800 palabras. Solo el contenido HTML, sin html/body tags.`,
  },
}

async function getGuideContent(keyword: string): Promise<string> {
  const config = GUIDE_CONFIG[keyword]
  if (!config) return ""

  // Check if cached in DB
  const magnet = await prisma.leadMagnet.findUnique({ where: { keyword: config.keyword } }).catch(() => null)
  if (magnet?.guideUrl) {
    // guideUrl is set, but we store HTML content in description field if short enough
  }

  // Generate with Claude
  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: config.prompt }],
    })
    return message.content[0].type === "text" ? message.content[0].text : ""
  } catch {
    return "<p>Contenido disponible próximamente.</p>"
  }
}

export default async function GuidePage({ params }: { params: { keyword: string } }) {
  const keyword = params.keyword.toLowerCase()
  const config = GUIDE_CONFIG[keyword]
  if (!config) notFound()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"
  const bookingUrl = `${appUrl}/book`
  const content = await getGuideContent(keyword)

  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{config.title} — Catherine Gomez Realtor</title>
        <meta name="description" content={config.subtitle} />
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Georgia, serif; background: #f8f7f4; color: #333; }
          .header { background: #1a1a2e; padding: 32px 24px; text-align: center; }
          .header-tag { color: ${config.color}; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; font-family: Arial, sans-serif; margin-bottom: 8px; }
          .header-title { color: #fff; font-size: 26px; font-weight: bold; line-height: 1.3; margin-bottom: 8px; }
          .header-sub { color: #aaa; font-size: 14px; font-family: Arial, sans-serif; }
          .container { max-width: 680px; margin: 0 auto; padding: 40px 24px; }
          .content h2 { color: #1a1a2e; font-size: 20px; margin: 32px 0 12px; border-left: 4px solid ${config.color}; padding-left: 12px; }
          .content p { font-size: 16px; line-height: 1.8; margin-bottom: 16px; color: #444; }
          .content ul { margin: 12px 0 16px 20px; }
          .content li { font-size: 15px; line-height: 1.7; color: #444; margin-bottom: 6px; }
          .content strong { color: #1a1a2e; }
          .cta-box { background: #1a1a2e; border-radius: 12px; padding: 32px; text-align: center; margin: 40px 0; }
          .cta-box h3 { color: ${config.color}; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; font-family: Arial, sans-serif; margin-bottom: 12px; }
          .cta-box p { color: #ddd; font-size: 15px; font-family: Arial, sans-serif; margin-bottom: 20px; line-height: 1.6; }
          .cta-btn { display: inline-block; background: ${config.color}; color: #fff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-size: 15px; font-weight: bold; font-family: Arial, sans-serif; }
          .agent-card { display: flex; align-items: center; gap: 16px; background: #fff; border: 1px solid #e5e0d5; border-radius: 12px; padding: 20px; margin-top: 32px; }
          .agent-info h4 { color: #1a1a2e; font-size: 16px; margin-bottom: 4px; }
          .agent-info p { color: #888; font-size: 13px; font-family: Arial, sans-serif; margin-bottom: 2px; }
          .agent-info a { color: ${config.color}; text-decoration: none; font-family: Arial, sans-serif; font-size: 13px; }
          .print-btn { display: block; text-align: center; margin: 16px 0; }
          .print-btn button { background: none; border: 1px solid #ccc; padding: 8px 20px; border-radius: 6px; font-size: 13px; cursor: pointer; color: #666; font-family: Arial, sans-serif; }
          @media print { .print-btn, .cta-box { display: none; } }
        `}</style>
      </head>
      <body>
        <div className="header">
          <p className="header-tag">Catherine Gomez Realtor · Miami</p>
          <h1 className="header-title">{config.title}</h1>
          <p className="header-sub">{config.subtitle}</p>
        </div>

        <div className="container">
          <div className="print-btn">
            <button onClick="window.print()">Descargar / Imprimir como PDF</button>
          </div>

          <div
            className="content"
            dangerouslySetInnerHTML={{ __html: content }}
          />

          <div className="cta-box">
            <h3>¿Listo para el siguiente paso?</h3>
            <p>
              Agenda una consulta gratuita con Catherine Gomez.<br />
              Más de 15 años ayudando a familias hispanas en South Florida.
            </p>
            <a href={bookingUrl} className="cta-btn">
              Agendar consulta gratuita →
            </a>
          </div>

          <div className="agent-card">
            <div className="agent-info">
              <h4>Catherine Gomez</h4>
              <p>Realtor · South Florida · 15+ años de experiencia</p>
              <a href="tel:3052830872">(305) 283-0872</a>
              {" · "}
              <a href="mailto:info@catherinegomezrealtor.com">info@catherinegomezrealtor.com</a>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}

export const revalidate = 86400
