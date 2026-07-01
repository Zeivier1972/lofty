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
  // ── Price & location comparisons ──
  { id: "price_comparison", hook: "¿Qué te compras con $X en [Location]?", format: "comparison" },
  { id: "vs_comparison", hook: "[Location] vs [Location] — ¿cuál es mejor para invertir con $X?", format: "debate" },
  { id: "vs_rent", hook: "¿Alquilar o comprar en Miami? La respuesta honesta en 2026", format: "decision" },
  { id: "brickell_vs_homestead", hook: "Brickell o Homestead con $X — te digo la verdad sin filtros", format: "debate" },
  { id: "miami_vs_orlando", hook: "¿Miami o Orlando para invertir? Los números hablan", format: "debate" },

  // ── Market data & trends ──
  { id: "market_update", hook: "Actualización del mercado Miami [Month] [Year] — lo que debes saber", format: "data" },
  { id: "interest_rates", hook: "Tasas de interés en 2026 — ¿es buen momento para comprar en Miami?", format: "data" },
  { id: "appreciation", hook: "Cuánto ha subido el valor de las casas en Miami en los últimos 5 años", format: "data" },
  { id: "inventory", hook: "Por qué hay tan pocas casas en venta en Miami — y qué hacer", format: "data" },

  // ── First-time buyers ──
  { id: "first_time_step_by_step", hook: "Comprando tu primera casa en Miami: el proceso paso a paso", format: "education" },
  { id: "down_payment", hook: "¿Cuánto necesitas de inicial para comprar en Miami?", format: "education" },
  { id: "fha_vs_conventional", hook: "FHA o préstamo convencional — cuál te conviene si vas a comprar en Miami", format: "education" },
  { id: "credit_score", hook: "¿Qué crédito necesitas para comprar casa en Miami? La respuesta exacta", format: "education" },
  { id: "closing_costs", hook: "Costos de cierre en Florida — nadie te dice cuánto son realmente", format: "myth_busting" },
  { id: "down_payment_assist", hook: "Programas de ayuda para el pago inicial en Florida que no conoces", format: "education" },

  // ── Investment & ROI ──
  { id: "airbnb_roi", hook: "Cuánto genera un Airbnb en Miami al mes — los números reales", format: "roi" },
  { id: "preconstruction", hook: "Pre-construcción en Brickell 2026 — ¿vale la pena?", format: "investment" },
  { id: "multi_family", hook: "Cómo generar ingresos pasivos con una propiedad en Miami", format: "investment" },
  { id: "homestead_roi", hook: "Cómo mis clientes compraron en Homestead por $300k y ganaron X%", format: "story" },
  { id: "long_term_vs_airbnb", hook: "Airbnb vs renta a largo plazo en Miami — comparativa real 2026", format: "roi" },
  { id: "investment_secrets", hook: "El secreto que los inversores de Miami no quieren que sepas", format: "insider" },
  { id: "1031_exchange", hook: "Qué es el 1031 Exchange y cómo usarlo para no pagar impuestos al vender", format: "education" },

  // ── Sellers & resale ──
  { id: "sell_fast", hook: "Cómo vender tu casa en Miami rápido y al mejor precio", format: "education" },
  { id: "staging_tips", hook: "X cosas que debes hacer ANTES de poner tu casa en venta en Miami", format: "listicle" },
  { id: "pricing_strategy", hook: "Por qué el precio que le pones a tu casa lo es todo — y cómo elegirlo", format: "education" },
  { id: "renovations_roi", hook: "¿Qué renovaciones aumentan el valor de tu casa en Florida?", format: "roi" },

  // ── Family & lifestyle ──
  { id: "family_neighborhoods", hook: "Los mejores vecindarios de Miami para familias hispanas en 2026", format: "lifestyle" },
  { id: "school_districts", hook: "Los distritos escolares de Miami que todos los padres deben conocer", format: "education" },
  { id: "neighborhood_tour", hook: "Tour por [Neighborhood]: así luce la vida en [Location]", format: "lifestyle" },
  { id: "doral_vs_kendall", hook: "Doral vs Kendall — ¿cuál es mejor para vivir con familia en Miami?", format: "debate" },

  // ── International & special buyers ──
  { id: "no_citizenship", hook: "Cómo comprar en Miami sin ser ciudadano americano — guía completa", format: "education" },
  { id: "colombia_buyers", hook: "Por qué Colombia es el #1 comprador de propiedades en Miami", format: "trend" },
  { id: "itin_mortgage", hook: "Puedes comprar casa en Miami sin SSN — te explico cómo", format: "education" },
  { id: "why_buying_here", hook: "Por qué los latinos están comprando tanto en Miami ahora mismo", format: "trend" },

  // ── Myth-busting & education ──
  { id: "truth_about", hook: "La verdad sobre comprar en Miami que nadie te dice", format: "myth_busting" },
  { id: "x_things", hook: "X cosas que nadie te dice antes de comprar en Miami", format: "listicle" },
  { id: "hoa_reality", hook: "HOA en Florida — lo que nadie te explica antes de comprar", format: "myth_busting" },
  { id: "insurance_reality", hook: "Seguros de hogar en Florida: cuánto cuestan realmente en 2026", format: "data" },
  { id: "realtor_value", hook: "Por qué trabajar con un Realtor profesional te ahorra dinero — no lo gastas", format: "education" },

  // ── Personal brand & stories ──
  { id: "i_toured", hook: "Recorrí este condo de $X en [Location] — esto es lo que encontré", format: "tour" },
  { id: "success_story", hook: "Cómo ayudé a una familia colombiana a comprar su primera casa en Miami", format: "story" },
  { id: "catherine_advice", hook: "Si tuviera que comprar casa hoy en Miami, haría esto primero", format: "insider" },
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
  // Broad, rotating query set — covers all topic types, not just investment/Brickell
  const SEARCH_QUERIES = [
    "comprar casa Miami primera vez 2026",
    "Miami real estate market update 2026",
    "cómo comprar casa en Miami sin ciudadanía",
    "invertir propiedades Miami 2026",
    "Brickell condos pre-construcción",
    "primera casa Miami préstamo FHA",
    "Airbnb Miami rentabilidad 2026",
    "vender casa Miami precio mercado",
    "mejores vecindarios Miami familias",
    "Homestead Florida inversión inmobiliaria",
    "costos comprar casa Florida",
    "crédito hipoteca Miami latinos",
    "Doral Kendall casas familias hispanas",
    "pre-construction South Florida 2026",
    "seguros hogar Florida costos",
    "compradores colombianos Miami real estate",
    "cómo negociar compra casa Miami",
    "ROI rentar propiedad Miami",
    "first time home buyer Miami Florida",
    "real estate tips Miami español",
  ]

  // Pick query + format RANDOMLY so every generation is fresh — not locked to the
  // calendar day. (Day-locked selection meant every click on the same day produced
  // the identical topic, e.g. always "closing costs".)
  const query = SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)]
  const trendingVideos = await searchYouTubeTrending(query)

  // Random format from our expanded library so topics vary on every generation
  const format = VIRAL_FORMATS[Math.floor(Math.random() * VIRAL_FORMATS.length)]

  const now = new Date()
  const monthYear = now.toLocaleDateString("es-ES", { month: "long", year: "numeric" })

  const trendingContext = trendingVideos.length > 0
    ? `Videos que están funcionando esta semana en YouTube:\n${trendingVideos.slice(0, 5).map(v => `- "${v.title}" (${parseInt(v.viewCount).toLocaleString()} vistas)`).join("\n")}`
    : `No hay datos de YouTube disponibles. Usa los formatos probados.`

  const prompt = `Eres un experto en marketing de contenido para bienes raíces en South Florida.

${trendingContext}

Formato viral del día: "${format.hook}" (tipo: ${format.format})

Fecha: ${monthYear}
Agente: Catherine Gomez Realtor — experta en TODOS los aspectos del mercado inmobiliario de South Florida

COBERTURA DE TEMAS — Catherine educa a sus clientes en todo lo siguiente:
- Compradores de primera vez: proceso paso a paso, hipotecas, FHA, pago inicial, costos de cierre
- Inversión: pre-construcción, Airbnb, multi-family, ROI, 1031 exchange, apreciación
- Vendedores: staging, pricing, timing del mercado, renovaciones para maximizar precio
- Familias: vecindarios, escuelas, downsizing, move-up buyers, calidad de vida
- Compradores internacionales: comprar sin ciudadanía, ITIN mortgages, compradores colombianos/latinoamericanos
- Mercado y datos: tasas de interés, inventario, tendencias, comparativas por vecindario
- Educación financiera: crédito, seguros en Florida, HOA, impuestos de propiedad
- Vecindarios: Brickell, Homestead, Doral, Kendall, Coral Gables, Aventura, Miami Beach, Orlando

El tema del día DEBE ser variado — NO uses siempre Brickell vs Homestead. Elige el tema más relevante según el formato del día y los videos tendencia.

Genera un brief de contenido viral adaptado para Catherine. Devuelve SOLO JSON válido:
{
  "trendingTopic": "tema específico y accionable para hoy — varía entre compradores, vendedores, inversores, familias",
  "viralHook": "gancho de primera línea — máximo 12 palabras, impactante, específico con número si aplica",
  "format": "${format.format}",
  "additionalKeywords": ["keyword1", "keyword2", "keyword3", "keyword4"],
  "targetAudience": "descripción del público objetivo para hoy (compradores/vendedores/inversores/familias)",
  "engagementAngle": "curiosity|aspiration|fear|urgency|education",
  "youtubeTitle": "Título SEO para YouTube — incluye keyword principal y año 2026 — máximo 70 caracteres",
  "youtubeDescription": "Descripción completa para YouTube (300-400 palabras) con: intro, puntos clave del video, CTA para suscribirse, links a redes sociales, hashtags al final. Incluir: Catherine Gomez Realtor, Miami real estate, sus áreas. En español.",
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
    // Fallback briefs — varied so not always the same topic
    const FALLBACK_BRIEFS = [
      {
        trendingTopic: "cómo comprar tu primera casa en Miami paso a paso",
        viralHook: "Comprando tu primera casa en Miami — aquí está todo lo que necesitas saber",
        additionalKeywords: ["primera casa Miami", "FHA loan Florida", "pago inicial Miami", "costos de cierre"],
        targetAudience: "Compradores de primera vez, familias hispanas",
        engagementAngle: "education",
      },
      {
        trendingTopic: "inversión inmobiliaria en pre-construcción en South Florida",
        viralHook: "¿Qué te compras con $400k en Brickell hoy?",
        additionalKeywords: ["Brickell 2026", "pre-construcción Miami", "inversión Colombia", "condo Miami"],
        targetAudience: "Inversores colombianos e hispanos",
        engagementAngle: "curiosity",
      },
      {
        trendingTopic: "cómo vender tu casa en Miami al mejor precio",
        viralHook: "Antes de poner tu casa en venta en Miami, haz ESTO primero",
        additionalKeywords: ["vender casa Miami", "staging Miami", "precio mercado Miami", "realtor Miami"],
        targetAudience: "Propietarios que quieren vender",
        engagementAngle: "urgency",
      },
      {
        trendingTopic: "mejores vecindarios de Miami para familias hispanas",
        viralHook: "Los mejores vecindarios de Miami para criar a tus hijos en 2026",
        additionalKeywords: ["Doral Miami", "Kendall Florida", "escuelas Miami", "familias hispanas Miami"],
        targetAudience: "Familias buscando primera vivienda",
        engagementAngle: "aspiration",
      },
      {
        trendingTopic: "cómo comprar en Miami sin ser ciudadano americano",
        viralHook: "Puedes comprar casa en Miami sin SSN — te explico exactamente cómo",
        additionalKeywords: ["comprar Miami sin ciudadanía", "ITIN mortgage Florida", "compradores extranjeros Miami"],
        targetAudience: "Compradores internacionales latinoamericanos",
        engagementAngle: "education",
      },
      {
        trendingTopic: "Airbnb vs renta a largo plazo en Miami — cuál genera más",
        viralHook: "¿Airbnb o renta fija en Miami? Los números reales en 2026",
        additionalKeywords: ["Airbnb Miami 2026", "rental income Miami", "inversión Miami", "ROI propiedad"],
        targetAudience: "Inversores de propiedades de renta",
        engagementAngle: "curiosity",
      },
      {
        trendingTopic: "costos de cierre y gastos ocultos al comprar en Florida",
        viralHook: "Nadie te dice cuánto cuestan realmente los costos de cierre en Florida",
        additionalKeywords: ["closing costs Florida", "gastos comprar casa", "inspección Miami", "seguro hogar Florida"],
        targetAudience: "Compradores de primera vez",
        engagementAngle: "fear",
      },
    ]
    const fallback = FALLBACK_BRIEFS[Math.floor(Math.random() * FALLBACK_BRIEFS.length)]
    return {
      trendingTopic: fallback.trendingTopic,
      viralHook: fallback.viralHook,
      format: format.format,
      additionalKeywords: fallback.additionalKeywords,
      targetAudience: fallback.targetAudience,
      engagementAngle: fallback.engagementAngle as any,
      youtubeTitle: `${fallback.viralHook.slice(0, 60)} — Catherine Gomez Realtor`,
      youtubeDescription: `${fallback.trendingTopic}. Todo lo que necesitas saber sobre bienes raíces en Miami. Contacta a Catherine Gomez Realtor al (305) 283-0872.\n\n🏠 Suscríbete para más contenido de bienes raíces en Miami.\n\n#MiamiRealEstate #CatherineGomezRealtor #SouthFlorida`,
      youtubeTags: ["miami real estate", "catherine gomez realtor", "south florida real estate", "comprar casa miami", "bienes raices miami", "miami 2026", "miami realtor", "propiedades miami", "inversion inmobiliaria", "homestead florida", "brickell miami", "orlando florida", "primera casa miami", "familias hispanas miami", "miami condos"],
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
