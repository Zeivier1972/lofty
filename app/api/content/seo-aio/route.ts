export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Turn free-form content (e.g. pasted from an outside AI) into a ready-to-post
// package: SEO (keyword, title, platform caption, hashtags) + AIO / Answer-
// Engine Optimization (the question the content answers + a concise answer +
// FAQs, so ChatGPT/Perplexity/Google AI surface it). Returns structured JSON.

const PLATFORM_HINT: Record<string, string> = {
  INSTAGRAM: "Instagram Reels/post: gancho fuerte en la primera línea, 150-200 palabras, 3-5 emojis, CTA con (305) 283-0872 o 'link en bio'.",
  FACEBOOK: "Facebook post: 200-300 palabras, tono conversacional y educativo, 1-2 datos del mercado de Miami, CTA con (305) 283-0872.",
  YOUTUBE: "YouTube: descripción SEO 300-400 palabras, keyword en el primer párrafo, menciona Miami/South Florida y el año 2026.",
  TIKTOK: "TikTok: 80-100 palabras, gancho que detiene el scroll, tono casual, CTA tipo '¡Comenta MIAMI abajo!'.",
  LINKEDIN: "LinkedIn: 200-250 palabras, tono profesional con autoridad de mercado, termina con una pregunta.",
}

function extractJson(text: string): any {
  let t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) t = fence[1].trim()
  const start = t.indexOf("{")
  const end = t.lastIndexOf("}")
  if (start >= 0 && end > start) t = t.slice(start, end + 1)
  return JSON.parse(t)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { content, platform } = await req.json()
    if (!content || !String(content).trim()) return NextResponse.json({ error: "Pega el contenido primero" }, { status: 400 })
    const plat = (platform || "INSTAGRAM").toUpperCase()
    const hint = PLATFORM_HINT[plat] || PLATFORM_HINT.INSTAGRAM

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1400,
      system: `Eres Catherine Gomez, Realtor en Miami con 15 años de experiencia en South Florida, experta en SEO y en AIO (Answer Engine Optimization — optimizar contenido para que ChatGPT, Perplexity y Google AI lo citen). Escribes en español, primera persona, con expertise real. Respondes SOLO con JSON válido, sin texto adicional.`,
      messages: [
        {
          role: "user",
          content: `A partir de este contenido (puede venir de otra IA o de una idea suelta), crea un paquete de publicación optimizado para ${plat}.

CONTENIDO BASE:
"""
${String(content).slice(0, 4000)}
"""

Formato de la plataforma: ${hint}

Devuelve EXACTAMENTE este JSON:
{
  "keyword": "keyword principal (frase corta, alta intención de búsqueda)",
  "secondaryKeywords": ["3-5 keywords secundarias / long-tail"],
  "title": "título SEO de máx 60 caracteres con la keyword",
  "caption": "el texto listo para publicar en ${plat}, en español, siguiendo el formato de la plataforma, con la keyword integrada de forma natural",
  "hashtags": ["8-12 hashtags relevantes, cada uno empezando con #"],
  "aio": {
    "question": "la pregunta principal que este contenido responde (como la haría un usuario en ChatGPT o Google)",
    "answer": "respuesta concisa de 2-3 frases, factual y directa, optimizada para que un motor de IA la cite",
    "faqs": [{"q": "pregunta frecuente", "a": "respuesta breve"}, {"q": "...", "a": "..."}, {"q": "...", "a": "..."}]
  }
}`,
        },
      ],
    })

    const raw = msg.content[0].type === "text" ? msg.content[0].text : "{}"
    let data: any
    try { data = extractJson(raw) } catch { return NextResponse.json({ error: "No se pudo generar. Intenta de nuevo." }, { status: 502 }) }

    return NextResponse.json({
      ok: true,
      platform: plat,
      keyword: data.keyword || "",
      secondaryKeywords: Array.isArray(data.secondaryKeywords) ? data.secondaryKeywords : [],
      title: data.title || "",
      caption: data.caption || "",
      hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
      aio: {
        question: data.aio?.question || "",
        answer: data.aio?.answer || "",
        faqs: Array.isArray(data.aio?.faqs) ? data.aio.faqs : [],
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Error" }, { status: 500 })
  }
}
