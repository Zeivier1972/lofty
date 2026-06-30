export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PLATFORM_FORMATS: Record<string, string> = {
  INSTAGRAM: `Instagram Reels caption:
- Primera línea: gancho poderoso (máx 125 chars — aparece antes del "más")
- 150-200 palabras total en español
- 3-5 emojis estratégicos
- CTA: "Escríbeme al (305) 283-0872" o "Agenda tu consulta gratis — link en bio"
- Termina EXACTAMENTE con estos hashtags en una línea separada:
#MiamiRealEstate #BrickellMiami #HomesteadFlorida #OrlandoFlorida #PropiedadesMiami #InversionMiami #CatherineGomezRealtor #MiamiCondos #FloridaRealEstate #BieneRaiz #ComprarCasaMiami #SouthFlorida`,

  FACEBOOK: `Facebook video post:
- 200-300 palabras, tono conversacional y educativo
- Explica el valor del video en la primera oración
- Incluye 1-2 datos específicos del mercado de Miami
- CTA: "Escríbeme al (305) 283-0872" o "Agenda tu consulta gratuita hoy"
- Termina con 3-4 hashtags: #MiamiRealEstate #BieneRaices #CatherineGomezRealtor #SouthFlorida`,

  YOUTUBE: `YouTube Shorts descripción SEO:
Primero escribe: TÍTULO: [título SEO de 60 chars max, incluye keyword + año 2026]
Luego la descripción (300-400 palabras):
- Párrafo de apertura con keyword principal
- 3-4 secciones con timestamps si aplica (0:00 Intro, etc.)
- Menciona: Catherine Gomez Realtor, Miami, South Florida, año 2026
- Sección de recursos: "📞 (305) 283-0872"
- Termina con: "🔔 Suscríbete para más consejos de bienes raíces en Miami en español"
- Hashtags: #MiamiRealEstate #Shorts #BieneRaices #CatherineGomezRealtor #SouthFlorida`,

  TIKTOK: `TikTok video caption:
- 80-100 palabras en español
- Primeras palabras = gancho que detiene el scroll
- Tono casual y directo
- CTA: "¡Comenta MIAMI abajo!" o "¡Sígueme para más consejos!"
- Hashtags trending: #Miami #RealEstate #Invertir #BieneRaices #MiamiRealtor #FYP #CasaMiami #FloridaHomes`,

  LINKEDIN: `LinkedIn video post:
- 200-250 palabras, tono profesional con autoridad de mercado
- Dato de mercado o insight específico de Miami/South Florida
- Posiciona a Catherine como experta
- Termina con pregunta para generar comentarios
- Hashtags: #MiamiRealEstate #SouthFlorida #RealEstateInvesting #Realtor #InversionInmobiliaria`,
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { platform, script, topic } = await req.json()
    if (!platform) return NextResponse.json({ error: "platform required" }, { status: 400 })

    const format = PLATFORM_FORMATS[platform] ?? PLATFORM_FORMATS.INSTAGRAM
    const topicLine = topic ? `\nTema del video: ${topic}` : ""
    const scriptLine = script ? `\n\nGuión del video (referencia para el tema y tono):\n"${String(script).slice(0, 600)}"` : ""

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 700,
      system: `Eres Catherine Gomez, Realtor en Miami con 15 años de experiencia en el mercado de South Florida. Escribes en español, primera persona, con autenticidad y expertise real. Nunca usas frases genéricas o de relleno.`,
      messages: [
        {
          role: "user",
          content: `Escribe el texto para publicar este video en ${platform}.${topicLine}${scriptLine}

Formato requerido:
${format}

Escribe SOLO el texto listo para publicar. Sin preámbulos, sin explicaciones.`,
        },
      ],
    })

    const content = msg.content[0].type === "text" ? msg.content[0].text.trim() : ""
    return NextResponse.json({ content, platform })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
