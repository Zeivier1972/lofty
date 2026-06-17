/**
 * Content Research Engine — finds viral real estate formats for South Florida
 * Uses YouTube Data API for trend discovery, falls back to proven format library.
 *
 * Railway env vars needed:
 *   YOUTUBE_API_KEY  — Google Cloud Console → Credentials → API Key (read-only, no OAuth needed)
 */

import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Proven viral format library (used as fallback + inspiration) ─────────────

export const VIRAL_FORMATS = [
  { id: "price_comparison", hook: "¿Qué te compras con $X en [Location]?", format: "comparison" },
  { id: "why_buying_here", hook: "Por qué los [Audience] están comprando en [Location]", format: "trend" },
  { id: "truth_about", hook: "La verdad sobre comprar en Miami que nadie te dice", format: "myth_busting" },
  { id: "i_toured", hook: "Recorrí este condo de $X en [Location] — esto es lo que encontré", format: "tour" },
  { id: "vs_comparison", hook: "[Location] vs [Location] — ¿cuál es mejor para invertir con $X?", format: "debate" },
  { id: "market_update", hook: "Actualización del mercado Miami [Month] [Year] — lo que debes saber", format: "data" },
  { id: "x_things", hook: "X cosas que nadie te dice sobre comprar en Miami", format: "listicle" },
  { id: "no_citizenship", hook: "Cómo comprar en Miami sin ser ciudadano americano", format: "education" },
  { id: "airbnb_roi", hook: "Cuánto genera un Airbnb en Miami al mes — los números reales", format: "roi" },
  { id: "preconstruction", hook: "Pre-construcción en Brickell 2026 — ¿vale la pena?", format: "investment" },
  { id: "homestead_story", hook: "Cómo mis clientes compraron en Homestead por $300k y ganaron X%", format: "story" },
  { id: "vs_rent", hook: "¿Alquilar o comprar en Miami? La respuesta honesta en 2026", format: "decision" },
  { id: "colombia_buyers", hook: "Por qué Colombia es el #1 comprador de propiedades en Miami", format: "trend" },
  { id: "investment_secrets", hook: "El secreto que los inversores de Miami no quieren que sepas", format: "insider" },
  { id: "neighborhood_tour", hook: "Tour por [Neighborhood]: así luce la vida en [Location]", format: "lifestyle" },
]

// ─── YouTube trending research ────────────────────────────────────────────────

interface YouTubeVideo {
  title: string
  viewCount: string
  publishedAt: string
  channelTitle: string
}

async function searchYouTubeTrending(query: string): Promise<YouTubeVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return []

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  try {
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search")
    searchUrl.searchParams.set("part", "snippet")
    searchUrl.searchParams.set("q", query)
    searchUrl.searchParams.set("type", "video")
    searchUrl.searchParams.set("order", "viewCount")
    searchUrl.searchParams.set("regionCode", "US")
    searchUrl.searchParams.set("relevanceLanguage", "es")
    searchUrl.searchParams.set("publishedAfter", oneWeekAgo)
    searchUrl.searchParams.set("maxResults", "10")
    searchUrl.searchParams.set("key", apiKey)

    const res = await fetch(searchUrl.toString())
    if (!res.ok) return []
    const data = await res.json()

    const videoIds = (data.items || []).map((i: any) => i.id?.videoId).filter(Boolean)
    if (!videoIds.length) return []

    // Get view counts
    const statsUrl = new URL("https://www.googleapis.com/youtube/v3/videos")
    statsUrl.searchParams.set("part", "statistics,snippet")
    statsUrl.searchParams.set("id", videoIds.join(","))
    statsUrl.searchParams.set("key", apiKey)

    const statsRes = await fetch(statsUrl.toString())
    const statsData = await statsRes.json()

    return (statsData.items || []).map((item: any) => ({
      title: item.snippet?.title || "",
      viewCount: item.statistics?.viewCount || "0",
      publishedAt: item.snippet?.publishedAt || "",
      channelTitle: item.snippet?.channelTitle || "",
    }))
  } catch (err) {
    console.error("[content-research] YouTube API error:", err)
    return []
  }
}

// ─── Research brief ───────────────────────────────────────────────────────────

export interface ResearchBrief {
  trendingTopic: string
  viralHook: string
  format: string
  additionalKeywords: string[]
  targetAudience: string
  engagementAngle: string  // curiosity | aspiration | fear | urgency | education
  youtubeTitle: string     // SEO-optimized YouTube title
  youtubeDescription: string // Full YouTube description with SEO
  youtubeTags: string[]
}

export async function researchViralContent(dayOfWeek: number): Promise<ResearchBrief> {
  const SEARCH_QUERIES = [
    "Miami real estate 2026",
    "comprar casa Miami",
    "Brickell condos investment",
    "pre-construction South Florida",
    "invertir Miami propiedades",
  ]

  // Rotate search queries by day
  const query = SEARCH_QUERIES[dayOfWeek % SEARCH_QUERIES.length]
  const trendingVideos = await searchYouTubeTrending(query)

  // Pick a deterministic format from our library
  const format = VIRAL_FORMATS[dayOfWeek % VIRAL_FORMATS.length]

  const now = new Date()
  const monthYear = now.toLocaleDateString("es-ES", { month: "long", year: "numeric" })

  const trendingContext = trendingVideos.length > 0
    ? `Videos que están funcionando esta semana en YouTube:\n${trendingVideos.slice(0, 5).map(v => `- "${v.title}" (${parseInt(v.viewCount).toLocaleString()} vistas)`).join("\n")}`
    : `No hay datos de YouTube disponibles. Usa los formatos probados.`

  const prompt = `Eres un experto en marketing de contenido para bienes raíces en South Florida.

${trendingContext}

Formato viral del día: "${format.hook}" (tipo: ${format.format})

Fecha: ${monthYear}
Mercados clave: Brickell (Miami), Homestead, Orlando, South Florida
Audiencia principal: Compradores e inversores hispanos, especialmente colombianos
Agente: Catherine Gomez Realtor

Genera un brief de contenido viral adaptado para Catherine. Devuelve SOLO JSON válido:
{
  "trendingTopic": "tema específico y local para hoy",
  "viralHook": "gancho de primera línea — máximo 12 palabras, impactante, específico",
  "format": "${format.format}",
  "additionalKeywords": ["keyword1", "keyword2", "keyword3", "keyword4"],
  "targetAudience": "descripción del público objetivo para hoy",
  "engagementAngle": "curiosity|aspiration|fear|urgency|education",
  "youtubeTitle": "Título SEO para YouTube — incluye keyword principal y año 2026 — máximo 70 caracteres",
  "youtubeDescription": "Descripción completa para YouTube (300-400 palabras) con: intro, puntos clave del video, CTA para suscribirse, links a redes sociales, hashtags al final. Incluir: Catherine Gomez Realtor, Miami real estate, sus áreas (Brickell, Homestead, Orlando). En español.",
  "youtubeTags": ["tag1","tag2","tag3",...20 tags en inglés y español]
}`

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    })
    const text = (message.content[0] as any).text.trim()
    const clean = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim()
    return JSON.parse(clean) as ResearchBrief
  } catch (err) {
    console.error("[content-research] Brief generation failed:", err)
    // Fallback brief
    return {
      trendingTopic: format.hook.replace("[Location]", "Miami").replace("[Audience]", "colombianos").replace("$X", "$400k"),
      viralHook: "¿Qué te compras con $400k en Brickell hoy?",
      format: format.format,
      additionalKeywords: ["Brickell 2026", "pre-construcción Miami", "inversión Colombia"],
      targetAudience: "Inversores colombianos e hispanos",
      engagementAngle: "curiosity",
      youtubeTitle: `Mercado Inmobiliario Miami ${new Date().getFullYear()} — Catherine Gomez Realtor`,
      youtubeDescription: `Información sobre el mercado inmobiliario de Miami. Contacta a Catherine Gomez Realtor.\n\n🏠 Suscríbete para más contenido de bienes raíces en Miami.\n\n#MiamiRealEstate #BrickellMiami #CatherineGomezRealtor`,
      youtubeTags: ["miami real estate", "brickell miami", "catherine gomez realtor", "miami condos", "south florida real estate", "pre-construction miami", "invertir miami", "comprar casa miami", "homestead florida", "orlando florida", "miami realtor", "bienes raices miami", "inversion inmobiliaria", "propiedades miami", "miami 2026"],
    }
  }
}

// ─── AIO-optimized content wrapper ───────────────────────────────────────────

export function buildAIOSystemPrompt(): string {
  return `Eres Catherine Gomez, Realtor con más de 15 años en South Florida. Tus posts están optimizados para:

1. SEO CLÁSICO: Keywords en los primeros 160 caracteres, uso natural de términos locales, precios específicos
2. AIO (AI Overview Optimization): Respuestas directas a preguntas específicas, datos verificables, autoridad local
3. ENGAGEMENT: Gancho poderoso en la primera línea, pregunta o provocación, CTA clara al final

Reglas de AIO:
- Incluye al menos UN dato específico (precio, porcentaje, número de unidades)
- Menciona el año (2026) cuando sea relevante
- Usa el nombre completo del barrio al menos una vez (no solo "Brickell", sino "Brickell, Miami")
- Primera línea = respuesta directa a una pregunta común del mercado
- Última línea = CTA + cómo contactarte

Siempre en español. Nunca genérico. Siempre local y específico.`
}
