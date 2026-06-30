import Anthropic from "@anthropic-ai/sdk"
import { prisma } from "@/lib/prisma"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export function extractKeyword(script: string): string | null {
  const match = script.match(/[Cc]omenta\s+['"]?([A-ZÁÉÍÓÚÜÑ]{3,})['"']?/i)
  return match ? match[1].toUpperCase() : null
}

function slugify(keyword: string): string {
  return keyword.toLowerCase()
    .replace(/[áä]/g, "a").replace(/[éë]/g, "e").replace(/[íï]/g, "i")
    .replace(/[óö]/g, "o").replace(/[úü]/g, "u").replace(/ñ/g, "n")
    .replace(/[^a-z0-9]/g, "-")
}

export async function generateGuideFromScript(
  script: string,
  { overwrite = false }: { overwrite?: boolean } = {}
): Promise<{ keyword: string; title: string; guideUrl: string; skipped?: boolean } | null> {
  const keyword = extractKeyword(script)
  if (!keyword) return null

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"
  const guideUrl = `${appUrl}/guides/${slugify(keyword)}`

  // If this keyword already has a guide and we're not explicitly overwriting, skip
  if (!overwrite) {
    const existing = await prisma.leadMagnet.findUnique({ where: { keyword } })
    if (existing) {
      console.log(`[generate-guide] Keyword "${keyword}" already has a guide — skipping regeneration`)
      return { keyword, title: existing.title, guideUrl: existing.guideUrl ?? guideUrl, skipped: true }
    }
  }

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 3000,
    system: `Eres Catherine Gomez, Realtor en Miami con 15 años de experiencia. Escribes guías de bienes raíces en español para familias hispanas. Primera persona, tono cálido y experto.`,
    messages: [{
      role: "user",
      content: `Basándote en este guión de video de redes sociales, crea una guía completa en formato HTML.

GUIÓN DEL VIDEO:
${script}

INSTRUCCIONES:
- La guía debe expandir y profundizar el tema del guión (no solo repetirlo)
- Incluye datos específicos, pasos de acción y consejos prácticos del mercado de Miami
- Formato HTML: usa <h2> para secciones, <p> para párrafos, <ul><li> para listas, <strong> para énfasis
- Agrega una sección de Preguntas Frecuentes al final con 3 preguntas relacionadas al tema
- Termina con un CTA para agendar consulta gratuita con Catherine al (305) 283-0872
- 700-900 palabras
- NO incluyas <html>, <head>, <body> — solo el contenido interno

También devuelve:
- Un título SEO para la guía (máx 65 caracteres)
- Una descripción de 1 oración (para el subtítulo)

Responde SOLO con JSON válido:
{
  "title": "...",
  "description": "...",
  "content": "... HTML aquí ..."
}`,
    }],
  })

  const raw = message.content[0].type === "text" ? message.content[0].text.trim() : ""
  const clean = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim()
  const parsed = JSON.parse(clean)

  await prisma.leadMagnet.upsert({
    where: { keyword },
    create: { keyword, title: parsed.title, description: parsed.description, content: parsed.content, scriptSource: script, guideUrl },
    update: overwrite ? { title: parsed.title, description: parsed.description, content: parsed.content, scriptSource: script, guideUrl } : {},
  })

  // Auto-create Instagram + Facebook campaigns so the keyword appears in the bot UI
  // and the existing campaign PDF delivery mechanism sends the guide at COMPLETE
  const topicGreeting = `¡Hola! 🏠 Vi que comentaste en mi video sobre "${parsed.title}". Te envío la guía gratuita ahora mismo — solo necesito un par de datos rápidos. ¿Cuál es tu nombre?`

  const campaignData = {
    name: parsed.title,
    keywords: `${keyword},${slugify(keyword)}`,
    pdfUrl: guideUrl,
    pdfName: parsed.title,
    greeting: topicGreeting,
    isActive: true,
  }
  await prisma.instagramBotCampaign.upsert({
    where: { keyword },
    create: { keyword, ...campaignData },
    update: campaignData,
  }).catch(e => console.error("[generate-guide] IG campaign upsert failed:", e))
  await prisma.facebookBotCampaign.upsert({
    where: { keyword },
    create: { keyword, ...campaignData },
    update: campaignData,
  }).catch(e => console.error("[generate-guide] FB campaign upsert failed:", e))

  console.log(`[generate-guide] Guide + campaigns upserted for keyword="${keyword}" → ${guideUrl}`)
  return { keyword, title: parsed.title, guideUrl }
}
