/**
 * Social Media Auto-Pilot — Catherine Gomez Realtor
 *
 * Runs twice daily via Railway cron:
 *   Morning slot (9 AM ET)  — image + text posts on all connected platforms
 *   Evening slot (6 PM ET)  — HeyGen video on Tue/Fri, otherwise image + text
 *
 * Before every post, researches viral South Florida real estate formats
 * via YouTube Data API + Claude, then optimizes content for SEO + AIO.
 */

import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { v2 as cloudinary } from "cloudinary"
import { prisma } from "@/lib/prisma"
import { researchViralContent, buildAIOSystemPrompt, ResearchBrief } from "./content-research"
import { uploadVideoToYouTube } from "./youtube-upload"

// ─── SDK init ────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// ─── Daily theme rotation — 28 topics covering all buyer/seller/investor needs ─

// Returns day-of-year (1-365) so themes don't repeat for ~4 weeks
function getDayIndex(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  return Math.floor((now.getTime() - start.getTime()) / 86400000)
}

const DAILY_THEMES: string[] = [
  // Week 1 — Buyer education
  "guía paso a paso para compradores de primera vez en Miami",
  "cómo calificar para una hipoteca en Miami en 2026",
  "FHA vs préstamo convencional — cuál te conviene para comprar en Miami",
  "costos de cierre en Florida — todo lo que nadie te dice",
  "programas de ayuda para el pago inicial en Florida",
  "la inspección de vivienda en Miami — qué revisar antes de firmar",
  "qué crédito necesitas para comprar casa en Miami",
  // Week 2 — Investment & ROI
  "inversión en pre-construcción en Brickell y South Florida 2026",
  "Airbnb vs renta a largo plazo en Miami — los números reales",
  "cómo generar ingresos pasivos con propiedades en Miami",
  "cuánto ha valorizado tu propiedad en South Florida en 5 años",
  "invertir en Orlando Florida — guía para compradores hispanos",
  "el 1031 Exchange — cómo diferir impuestos al vender propiedades en Florida",
  "ROI de bienes raíces en Homestead — por qué todos están invirtiendo aquí",
  // Week 3 — Sellers & resale
  "cómo preparar tu casa para venderla rápido en Miami",
  "estrategia de precio al vender — cómo obtener el mejor precio en Miami",
  "renovaciones que aumentan el valor de tu casa en Florida",
  "el mercado de reventa en Miami — cuándo es el mejor momento para vender",
  "cómo negociar ofertas al vender tu casa en South Florida",
  "por qué vender sin Realtor te puede costar miles de dólares en Miami",
  "documentos que necesitas para vender tu propiedad en Florida",
  // Week 4 — Families, lifestyle & special topics
  "los mejores vecindarios de Miami para familias hispanas en 2026",
  "cómo comprar en Miami sin ser ciudadano americano",
  "Doral vs Kendall — cuál es mejor para vivir con familia en Miami",
  "seguros de hogar en Florida — cuánto cuestan y qué cubren",
  "HOA en Florida — qué es y cómo afecta tu compra de vivienda",
  "¿alquilar o comprar en Miami? La respuesta honesta en 2026",
  "historia de éxito — cómo ayudé a una familia hispana a comprar su primera casa",
]

const SEO_KEYWORDS = [
  "Catherine Gomez Realtor",
  "Miami real estate",
  "Brickell Miami",
  "Homestead Florida",
  "Orlando Florida",
  "pre-construcción Miami",
  "inversión inmobiliaria",
  "comprar casa Miami",
  "propiedades Miami",
  "South Florida real estate",
  "condos Miami",
  "Airbnb Miami investment",
  "luxury real estate Miami",
  "primera casa Miami",
  "FHA loan Florida",
  "costos cierre Florida",
  "hipoteca Miami",
  "Doral Miami",
  "Kendall Florida",
  "Coral Gables real estate",
  "Aventura condos",
  "Miami Beach propiedades",
  "vender casa Miami",
  "familias hispanas Miami",
  "compradores colombianos Miami",
  "HOA Florida",
  "seguros hogar Florida",
  "crédito hipoteca Miami",
]

function pickKeywords(dayOfWeek: number): string[] {
  const start = (getDayIndex() * 3) % SEO_KEYWORDS.length
  return [
    SEO_KEYWORDS[start % SEO_KEYWORDS.length],
    SEO_KEYWORDS[(start + 1) % SEO_KEYWORDS.length],
    SEO_KEYWORDS[(start + 2) % SEO_KEYWORDS.length],
  ]
}

// ─── Platform-specific prompt guides ─────────────────────────────────────────

const PLATFORM_GUIDES: Record<string, string> = {
  FACEBOOK:
    "Formato Facebook: 200-300 palabras, tono conversacional, usa emojis de forma moderada, termina con una CTA clara (ej: escríbeme, agenda una llamada, etc).",
  INSTAGRAM:
    "Formato Instagram: primera línea debe ser un gancho poderoso, máximo 150 palabras, termina con exactamente estos 12 hashtags en orden: #MiamiRealEstate #BrickellMiami #HomesteadFlorida #OrlandoFlorida #PropiedadesMiami #InversionMiami #CatherineGomezRealtor #MiamiCondos #FloridaRealEstate #BieneRaiz #ComprarCasaMiami #SouthFlorida",
  LINKEDIN:
    "Formato LinkedIn: tono profesional, 200 palabras, incluye insights del mercado, establece autoridad, termina con una pregunta para generar comentarios.",
  TIKTOK:
    "Formato TikTok: 80-100 palabras, gancho inmediato en las primeras palabras, hashtags cortos al final: #Miami #RealEstate #Invertir #BieneRaices #MiamiRealtor",
  TWITTER:
    "Formato Twitter/X: máximo 260 caracteres, mensaje impactante y directo, 3 hashtags relevantes.",
  YOUTUBE:
    "Formato YouTube Shorts: descripción optimizada para SEO (300-400 palabras), incluye el año 2026, menciona Brickell Miami y Catherine Gomez Realtor, termina con CTA de suscripción y hashtags relevantes.",
  GOOGLE_BUSINESS:
    "Formato Google Business: 150-250 palabras, tono profesional, menciona servicios y área de cobertura (Miami, Homestead, Orlando, South Florida).",
}

// ─── Content generation with Claude + AIO optimization ───────────────────────

async function generateContent(
  platform: string,
  dayOfWeek: number,
  research?: ResearchBrief
): Promise<string> {
  // For YouTube, use pre-built SEO description from research brief
  if (platform === "YOUTUBE" && research?.youtubeDescription) {
    return research.youtubeDescription
  }

  const theme = research?.trendingTopic ?? DAILY_THEMES[getDayIndex() % DAILY_THEMES.length]
  const keywords = research?.additionalKeywords?.length
    ? research.additionalKeywords
    : pickKeywords(dayOfWeek)
  const platformGuide = PLATFORM_GUIDES[platform] ?? PLATFORM_GUIDES.FACEBOOK

  const systemPrompt = research
    ? buildAIOSystemPrompt()
    : `Eres Catherine Gomez, Realtor en Miami con más de 15 años de experiencia en el mercado inmobiliario de South Florida. Escribes en primera persona, siempre en español, con autenticidad y expertise. Nunca usas frases genéricas o de relleno. Tu audiencia son compradores e inversores hispanohablantes.`

  const hookInstruction = research?.viralHook
    ? `\n\nGancho de apertura (usa esta primera línea exactamente o adáptala mínimamente): "${research.viralHook}"\nÁngulo de engagement: ${research.engagementAngle}`
    : ""

  const userPrompt = `Escribe un post de redes sociales sobre el tema del día: ${theme}.${hookInstruction}

Palabras clave SEO que DEBES incluir de forma natural (2-3 de ellas): ${keywords.join(", ")}.

Audiencia objetivo: ${research?.targetAudience ?? "compradores e inversores hispanohablantes en South Florida"}.

${platformGuide}

Escribe SOLO el contenido del post, listo para publicar. Sin explicaciones, sin preámbulos, sin etiquetas como "Post:" o "Caption:". Solo el texto del post.`

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  })

  const content = message.content[0].type === "text" ? message.content[0].text : ""
  return content.trim()
}

// ─── Image generation with DALL-E → Cloudinary ───────────────────────────────

async function generateAndUploadImage(dayOfWeek: number, research?: ResearchBrief): Promise<string | null> {
  const theme = research?.trendingTopic ?? DAILY_THEMES[getDayIndex() % DAILY_THEMES.length]

  try {
    const imagePrompt = `Professional Miami real estate photography, theme: ${theme}. Luxury properties, blue sky, palm trees, modern architecture. Photorealistic, bright daylight, no text or watermarks.`

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
      n: 1,
      size: "1024x1024",
    } as any)

    const b64 = (response.data as any[])?.[0]?.b64_json
    if (!b64) return null

    const uploadResult = await cloudinary.uploader.upload(
      `data:image/png;base64,${b64}`,
      { folder: "lofty-social" }
    )

    return uploadResult.secure_url
  } catch (err) {
    console.error("[social-autopilot] Image generation/upload failed:", err)
    return null
  }
}

// ─── HeyGen video generation ──────────────────────────────────────────────────

export async function generateVideoScript(dayOfWeek: number, research?: ResearchBrief): Promise<string> {
  const theme = research?.trendingTopic ?? DAILY_THEMES[getDayIndex() % DAILY_THEMES.length]
  const keywords = research?.additionalKeywords?.slice(0, 2) ?? pickKeywords(dayOfWeek).slice(0, 2)
  const hook = research?.viralHook

  const hookLine = hook ? `\n\nCOMIENZA con esta línea exacta o muy parecida: "${hook}"` : ""

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: `Eres Catherine Gomez, Realtor en Miami. Escribes scripts de video cortos en español, naturales para hablar en cámara. Tu objetivo es viralidad y retención máxima.`,
    messages: [
      {
        role: "user",
        content: `Escribe un script de video de 50 segundos (aproximadamente 120-130 palabras) sobre: ${theme}.${hookLine}

Incluye de forma natural: ${keywords.join(", ")}.
El tono es cercano, profesional y directo. Termina con una CTA hablada (ej: "escríbeme al…" o "visita mi perfil").
Escribe SOLO el texto que dirá la persona en el video. Sin acotaciones de escena, sin instrucciones, sin corchetes.`,
      },
    ],
  })

  return message.content[0].type === "text" ? message.content[0].text.trim() : ""
}

interface HeyGenAvatar {
  avatar_id: string
  avatar_name?: string
  gender?: string
  preview_image_url?: string
}

// Catherine Gomez "8 looks" talking_photo avatar IDs — hardcoded, rotate by day of week.
const CATHERINE_TALKING_PHOTO_IDS: string[] = [
  "ab393d45f3044a89b92fc77d17f321b7",
  "28e35d5f82f64101a2584fb29e841a88",
  "ad3b10e46ce44ad8b9a9931f65e151cf",
  "7ec891d9cc9f43ffa0f38f67d945d38f",
  "0215c5d293fb4c89b42130da184ded5b",
  "bc75573c848f42218ee27d37e623a4e6",
  "701d93d2d1834f2589a987aaf701720d",
  "f2bf0415eb4f4185b37673d3c876423c",
  "310728040e89413aa1c5b04ebb8bb9d3",
]

// Pick one of Catherine's talking_photo avatars. Prefers "8 looks" (user-preferred),
// then falls back to hardcoded IDs, then any avatar with "catherine" in the name.
function pickCatherineAvatar(
  talkingPhotos: HeyGenAvatar[],
  dayOfWeek: number
): string | null {
  // 1st priority: "Catherine Gomez 8 looks" (preferred by user)
  const eightLooks = talkingPhotos.filter(tp =>
    tp.avatar_name?.toLowerCase().includes("8 looks") ||
    tp.avatar_name?.toLowerCase().includes("8looks")
  )
  if (eightLooks.length > 0) {
    const pick = eightLooks[dayOfWeek % eightLooks.length]
    console.log(`[social-autopilot] Using "8 looks" avatar: "${pick.avatar_name}" (${pick.avatar_id})`)
    return pick.avatar_id
  }

  // 2nd priority: hardcoded confirmed IDs
  const idSet = new Set(CATHERINE_TALKING_PHOTO_IDS)
  const personal: HeyGenAvatar[] = []
  for (const id of CATHERINE_TALKING_PHOTO_IDS) {
    const found = talkingPhotos.find(tp => tp.avatar_id === id)
    if (found) personal.push(found)
  }
  if (personal.length > 0) {
    const pick = personal[dayOfWeek % personal.length]
    console.log(`[social-autopilot] Using talking_photo avatar: "${pick.avatar_name}" (${pick.avatar_id})`)
    return pick.avatar_id
  }

  // 3rd priority: any avatar whose name contains "catherine"
  const byName = talkingPhotos.filter(tp =>
    tp.avatar_name?.toLowerCase().includes("catherine") ||
    tp.avatar_name?.toLowerCase().includes("confident realtor")
  )
  if (byName.length > 0) {
    const pick = byName[dayOfWeek % byName.length]
    console.log(`[social-autopilot] Fallback by name: "${pick.avatar_name}" (${pick.avatar_id})`)
    return pick.avatar_id
  }

  // Last resort: any available talking_photo
  if (talkingPhotos.length > 0) {
    const pick = talkingPhotos[dayOfWeek % talkingPhotos.length]
    console.warn(`[social-autopilot] No Catherine avatar matched — using first available: "${pick.avatar_name}" (${pick.avatar_id}). Add its ID to CATHERINE_TALKING_PHOTO_IDS to confirm it.`)
    return pick.avatar_id
  }

  console.warn("[social-autopilot] No talking_photos found in HeyGen account — no video will be generated")
  return null
}

async function getHeyGenAvatar(dayOfWeek: number): Promise<{ avatarId: string; voiceId: string } | null> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) return null

  try {
    // Pick Catherine's avatar directly — hardcoded IDs rotate by day of week
    // (HeyGen API doesn't return these photo avatars in /v2/avatars, so skip the API lookup)
    const avatarId = CATHERINE_TALKING_PHOTO_IDS[dayOfWeek % CATHERINE_TALKING_PHOTO_IDS.length]
    console.log(`[social-autopilot] Catherine avatar: look ${(dayOfWeek % CATHERINE_TALKING_PHOTO_IDS.length) + 1} → ${avatarId}`)

    // Fetch voices to find Catalina (Catherine's preferred voice in HeyGen)
    const voicesRes = await fetch("https://api.heygen.com/v2/voices", {
      headers: { "X-Api-Key": apiKey },
    })
    const voicesData = await voicesRes.json()
    const voices: Array<{ voice_id: string; language?: string; locale?: string; gender?: string; name?: string }> =
      voicesData?.data?.voices ?? []

    if (voices.length === 0) {
      console.error("[social-autopilot] HeyGen voices empty:", JSON.stringify(voicesData))
      return null
    }

    const isSpanish = (v: { language?: string; locale?: string }) =>
      v.language === "es" || v.locale?.startsWith("es-") || v.locale === "es"

    const catalina = voices.find(v =>
      v.name?.toLowerCase().includes("catalina") ||
      v.name?.toLowerCase().includes("catherine")
    )
    const spanishFemale = voices.find(v => isSpanish(v) && v.gender?.toLowerCase() === "female")
    const spanishAny = voices.find(v => isSpanish(v))
    const selectedVoice = catalina ?? spanishFemale ?? spanishAny ?? voices[0]
    const voiceId = selectedVoice?.voice_id
    if (!voiceId) return null

    console.log(`[social-autopilot] Voice: "${selectedVoice?.name}" (${voiceId})`)
    return { avatarId, voiceId }
  } catch (err) {
    console.error("[social-autopilot] HeyGen avatar/voice fetch failed:", err)
    return null
  }
}

async function triggerHeyGenVideo(script: string, dayOfWeek: number): Promise<string | null> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) return null

  try {
    const avatarInfo = await getHeyGenAvatar(dayOfWeek)
    if (!avatarInfo) return null

    const talkingPhotoIds = new Set(CATHERINE_TALKING_PHOTO_IDS)
    const isTalkingPhoto = talkingPhotoIds.has(avatarInfo.avatarId)

    const character: Record<string, unknown> = isTalkingPhoto
      ? { type: "talking_photo", talking_photo_id: avatarInfo.avatarId }
      : { type: "avatar", avatar_id: avatarInfo.avatarId, avatar_style: "normal" }

    const videoInput: Record<string, unknown> = {
      character,
      voice: { type: "text", input_text: script, voice_id: avatarInfo.voiceId },
    }
    if (!isTalkingPhoto) {
      videoInput.background = { type: "color", value: "#1E3A5F" }
    }

    const payload = {
      video_inputs: [videoInput],
      dimension: { width: 720, height: 1280 },
    }

    console.log("[social-autopilot] HeyGen generate payload:", JSON.stringify(payload).slice(0, 300))

    const res = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json()

    if (!data?.data?.video_id) {
      console.error(`[social-autopilot] HeyGen generate failed (HTTP ${res.status}):`, JSON.stringify(data))
    } else {
      console.log(`[social-autopilot] HeyGen generate success — video_id: ${data.data.video_id}`)
    }

    return (data?.data?.video_id as string) ?? null
  } catch (err) {
    console.error("[social-autopilot] HeyGen video generation failed:", err)
    return null
  }
}

// ─── Blog post generation ─────────────────────────────────────────────────────

interface BlogPostData {
  title: string
  excerpt: string
  content: string
  tags: string[]
  sectionImagePrompts: string[]
}

async function generateBlogPostContent(
  dayOfWeek: number,
  research?: ResearchBrief
): Promise<BlogPostData | null> {
  const theme = research?.trendingTopic ?? DAILY_THEMES[getDayIndex() % DAILY_THEMES.length]
  const keywords = research?.additionalKeywords ?? pickKeywords(dayOfWeek)
  const hook = research?.viralHook ?? ""
  const now = new Date()
  const year = now.getFullYear()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"
  const idxActive = !!(process.env.RETS_LOGIN_URL || process.env.IDX_API_KEY)

  const systemPrompt = research
    ? buildAIOSystemPrompt()
    : `Eres Catherine Gomez, Realtor en Miami con más de 15 años de experiencia. Escribes artículos de blog en español, en primera persona, con autoridad y datos específicos del mercado de South Florida. Tu objetivo es SEO y AIO (optimización para inteligencia artificial).`

  const idxSection = idxActive
    ? `- Menciona que los lectores pueden ver propiedades disponibles ahora mismo en: <a href="${appUrl}/search" class="text-[#c9a84c] font-semibold hover:underline">buscar propiedades en Miami</a>`
    : ""

  const userPrompt = `Escribe un artículo de blog completo para el sitio web de Catherine Gomez Realtor sobre: "${theme}".

Gancho de apertura: "${hook}"
Palabras clave SEO a incluir: ${keywords.join(", ")}
Año de referencia: ${year}
URL del sitio: ${appUrl}

Catherine Gomez es la experta educadora de bienes raíces en South Florida para TODAS las familias hispanas.
Cubre TODOS los temas según el tema del día:
- Compradores de primera vez: proceso, financiamiento, errores comunes, programas de ayuda
- Inversores: pre-construcción, Airbnb, multi-family, ROI, apreciación
- Vendedores: staging, precio, timing, renovaciones
- Familias: vecindarios, escuelas, calidad de vida
- Compradores internacionales: proceso para no ciudadanos, ITIN
- Educación financiera: crédito, seguros, HOA, impuestos
Mercados: Brickell, Homestead, Doral, Kendall, Coral Gables, Aventura, Miami Beach, Orlando, South Florida
Audiencia: familias hispanas, especialmente colombianos, venezolanos, cubanos y todos los latinoamericanos

INSTRUCCIONES DE FORMATO — devuelve HTML puro (NO Markdown):
- Usa <h2> para los subtítulos de cada sección
- Usa <h3> para sub-secciones si las necesitas
- Usa <p> para párrafos (texto completo, bien desarrollado)
- Usa <strong> para énfasis en datos importantes
- Usa <ul><li> para listas cuando aplique
- Añade una sección <h2>Preguntas Frecuentes</h2> al final con 2-3 <h3> preguntas y respuestas cortas (esto mejora el ranking en Google y ChatGPT)
- NO incluyas <html>, <head>, <body> ni <style> — solo el contenido interno del artículo

HIPERVÍNCULOS INTERNOS requeridos — usa estos exactos:
- En la introducción o sección inicial: <a href="${appUrl}/site#contact" class="text-[#c9a84c] font-semibold hover:underline">agenda una consulta gratuita</a>
- En al menos una sección de propiedades: <a href="${appUrl}/search" class="text-[#c9a84c] font-semibold hover:underline">ver propiedades disponibles en Miami</a>
- Al final del artículo: <a href="${appUrl}/site/blog" class="text-[#c9a84c] hover:underline">más artículos sobre bienes raíces en Miami</a>
${idxSection}

ESTRUCTURA del artículo (600-800 palabras):
1. Párrafo de introducción con gancho poderoso
2. [IMG_SECTION_1] — coloca este placeholder exacto aquí (entre la intro y la primera sección)
3. Sección 1 con <h2> — tendencias/datos de mercado con al menos UN dato numérico
4. Sección 2 con <h2> — consejos prácticos o pasos de acción
5. [IMG_SECTION_2] — coloca este placeholder exacto aquí (antes de la sección 3)
6. Sección 3 con <h2> — oportunidad específica (barrio, tipo de propiedad o inversión)
7. Sección FAQ con <h2>Preguntas Frecuentes</h2> y 2-3 sub-preguntas
8. CTA final: párrafo invitando a contactar a Catherine Gomez al <strong>(305) 283-0872</strong>

SEO/AIO: Escribe como responderías a una búsqueda en Google o una pregunta en ChatGPT. Usa el lenguaje natural que usaría alguien buscando "comprar casa en Miami" o "invertir en Miami real estate".

Devuelve SOLO JSON válido con este formato exacto:
{
  "title": "Título SEO del artículo (máx 70 caracteres, incluye keyword principal)",
  "excerpt": "Meta descripción de 150-160 caracteres para SEO — resume con keyword principal y año",
  "content": "TODO el HTML del artículo con los placeholders [IMG_SECTION_1] y [IMG_SECTION_2] incluidos",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "sectionImagePrompts": [
    "Descripción en inglés para imagen 1 (estilo fotorrealista, real estate Miami, sin texto)",
    "Descripción en inglés para imagen 2 (estilo fotorrealista, real estate Miami, sin texto)"
  ]
}`

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    })

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : ""
    const clean = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim()
    return JSON.parse(clean) as BlogPostData
  } catch (err) {
    console.error("[social-autopilot] Blog post generation failed:", err)
    return null
  }
}

async function generateSectionImage(prompt: string, folder = "lofty-blog"): Promise<string | null> {
  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: `Professional Miami real estate photography. ${prompt}. Luxury properties, blue sky, palm trees, modern architecture. Photorealistic, bright daylight, no text or watermarks.`,
      n: 1,
      size: "1024x1024",
    } as any)

    const b64 = (response.data as any[])?.[0]?.b64_json
    if (!b64) return null

    const uploadResult = await cloudinary.uploader.upload(
      `data:image/png;base64,${b64}`,
      { folder }
    )

    return uploadResult.secure_url
  } catch (err) {
    console.error("[social-autopilot] Section image generation failed:", err)
    return null
  }
}

async function publishBlogPost(dayOfWeek: number, research?: ResearchBrief): Promise<boolean> {
  try {
    const data = await generateBlogPostContent(dayOfWeek, research)
    if (!data) return false

    const theme = research?.trendingTopic ?? DAILY_THEMES[getDayIndex() % DAILY_THEMES.length]

    // Generate cover + up to 2 section images in parallel (non-fatal if any fail)
    const coverPrompt = `${theme}, luxurious Miami waterfront property, golden hour`
    const [coverImage, sectionImg1, sectionImg2] = await Promise.all([
      generateSectionImage(coverPrompt, "lofty-blog"),
      data.sectionImagePrompts?.[0]
        ? generateSectionImage(data.sectionImagePrompts[0], "lofty-blog")
        : Promise.resolve(null),
      data.sectionImagePrompts?.[1]
        ? generateSectionImage(data.sectionImagePrompts[1], "lofty-blog")
        : Promise.resolve(null),
    ])

    // Embed section images into HTML content
    let html = data.content
    if (sectionImg1) {
      html = html.replace(
        "[IMG_SECTION_1]",
        `<figure class="my-8 rounded-2xl overflow-hidden shadow-md"><img src="${sectionImg1}" alt="${data.title}" class="w-full object-cover max-h-80" loading="lazy" /></figure>`
      )
    } else {
      html = html.replace("[IMG_SECTION_1]", "")
    }
    if (sectionImg2) {
      html = html.replace(
        "[IMG_SECTION_2]",
        `<figure class="my-8 rounded-2xl overflow-hidden shadow-md"><img src="${sectionImg2}" alt="${data.title}" class="w-full object-cover max-h-80" loading="lazy" /></figure>`
      )
    } else {
      html = html.replace("[IMG_SECTION_2]", "")
    }

    // Generate a unique slug from the title
    const baseSlug = data.title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
    const slug = `${baseSlug}-${Date.now()}`

    await prisma.blogPost.create({
      data: {
        title: data.title,
        slug,
        excerpt: data.excerpt,
        content: html,
        coverImage,
        author: "Catherine Gomez",
        tags: JSON.stringify(data.tags),
        featured: false,
        published: true,
        publishedAt: new Date(),
      },
    })

    console.log(`[social-autopilot] Blog post published: "${data.title}"`)

    // Share the blog post on connected social accounts (Facebook / Instagram)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"
    const blogUrl = `${appUrl}/site/blog/${slug}`
    await shareBlogOnSocial(data.title, data.excerpt, blogUrl, coverImage, dayOfWeek, research)

    return true
  } catch (err) {
    console.error("[social-autopilot] Blog post publish failed:", err)
    return false
  }
}

async function shareBlogOnSocial(
  title: string,
  excerpt: string,
  blogUrl: string,
  coverImage: string | null,
  dayOfWeek: number,
  research?: ResearchBrief
): Promise<void> {
  try {
    const accounts = await prisma.socialAccount.findMany({
      where: { platform: { in: ["FACEBOOK", "INSTAGRAM"] }, isConnected: true },
    })

    if (accounts.length === 0) return

    for (const account of accounts) {
      try {
        const platformGuide = PLATFORM_GUIDES[account.platform] ?? ""
        const message = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 400,
          system: `Eres Catherine Gomez, Realtor en Miami. Escribes posts de redes sociales en español para compartir artículos de blog. ${platformGuide}`,
          messages: [
            {
              role: "user",
              content: `Escribe un post para ${account.platform} compartiendo este artículo:\n\nTítulo: ${title}\nResumen: ${excerpt}\nURL: ${blogUrl}\n\nEl post debe invitar a leer el artículo, terminar con el link ${blogUrl} y ser llamativo.`,
            },
          ],
        })

        const postContent =
          message.content[0].type === "text"
            ? message.content[0].text.trim()
            : `📖 Nuevo artículo: ${title}\n\n${excerpt}\n\n👉 Leer más: ${blogUrl}`

        const fakePost: PostLike = {
          id: `blog-share-${Date.now()}`,
          platform: account.platform,
          content: postContent,
          mediaUrl: coverImage,
          prompt: null,
        }

        if (account.platform === "FACEBOOK") {
          await publishToFacebook(account, fakePost)
        } else if (account.platform === "INSTAGRAM" && coverImage) {
          await publishToInstagram(account, fakePost)
        }

        await prisma.socialPost.create({
          data: {
            accountId: account.id,
            platform: account.platform,
            content: postContent,
            mediaUrl: coverImage,
            status: "POSTED",
            publishedAt: new Date(),
          },
        })

        console.log(`[social-autopilot] Blog shared on ${account.platform}`)
      } catch (err) {
        console.error(`[social-autopilot] Blog share on ${account.platform} failed:`, err)
      }
    }
  } catch (err) {
    console.error("[social-autopilot] shareBlogOnSocial failed:", err)
  }
}

// ─── checkHeygenVideos — polls pending video posts ───────────────────────────

export async function checkHeygenVideos(): Promise<{ checked: number; completed: number }> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) return { checked: 0, completed: 0 }

  const pendingPosts = await prisma.socialPost.findMany({
    where: { status: "GENERATING_VIDEO", externalId: { not: null } },
    include: { account: true },
  })

  let completed = 0

  for (const post of pendingPosts) {
    try {
      const res = await fetch(
        `https://api.heygen.com/v1/video_status.get?video_id=${post.externalId}`,
        { headers: { "X-Api-Key": apiKey } }
      )
      const data = await res.json()
      const status: string | undefined = data?.data?.status
      const videoUrl: string | undefined = data?.data?.video_url

      if (status === "completed" && videoUrl) {
        await prisma.socialPost.update({
          where: { id: post.id },
          data: { status: "SCHEDULED", mediaUrl: videoUrl },
        })

        if (post.account) {
          await publishPost({ ...post, mediaUrl: videoUrl }, post.account)
        }

        completed++
      } else if (status === "failed") {
        await prisma.socialPost.update({
          where: { id: post.id },
          data: { status: "FAILED" },
        })
      }
    } catch (err) {
      console.error(`[social-autopilot] HeyGen status check failed for post ${post.id}:`, err)
    }
  }

  return { checked: pendingPosts.length, completed }
}

// ─── publishPost — platform-specific publishing ───────────────────────────────

type AccountLike = {
  platform: string
  accountId: string | null
  accessToken: string | null
  refreshToken: string | null
  pageId: string | null
}

type PostLike = {
  id: string
  platform: string
  content: string
  mediaUrl: string | null
  prompt: string | null
}

async function publishToFacebook(account: AccountLike, post: PostLike): Promise<string> {
  if (!account.accessToken || !account.pageId) throw new Error("Facebook: missing credentials")

  const isVideo = !!(post.mediaUrl?.includes(".mp4") || post.mediaUrl?.includes("video"))
  const isImage = !!(post.mediaUrl && !isVideo)

  let endpoint: string
  const body: Record<string, string> = { access_token: account.accessToken }

  if (isVideo) {
    endpoint = `https://graph.facebook.com/v19.0/${account.pageId}/videos`
    body.description = post.content
    body.file_url = post.mediaUrl!
  } else if (isImage) {
    // Photo post — use /photos endpoint with caption + url
    endpoint = `https://graph.facebook.com/v19.0/${account.pageId}/photos`
    body.caption = post.content
    body.url = post.mediaUrl!
  } else {
    // Text-only post
    endpoint = `https://graph.facebook.com/v19.0/${account.pageId}/feed`
    body.message = post.content
  }

  const res = await fetch(endpoint, {
    method: "POST",
    body: new URLSearchParams(body),
  })
  const data = await res.json()
  if (data.error) throw new Error(`Facebook API: ${data.error.message} (code ${data.error.code})`)
  return (data.post_id ?? data.id) as string
}

async function publishToInstagram(account: AccountLike, post: PostLike): Promise<string> {
  if (!account.accessToken || !account.pageId) throw new Error("Instagram: missing credentials")

  const isVideo = !!(post.mediaUrl?.includes(".mp4") || post.mediaUrl?.includes("video"))

  const containerParams: Record<string, string> = {
    caption: post.content,
    access_token: account.accessToken,
  }

  if (isVideo && post.mediaUrl) {
    containerParams.media_type = "VIDEO"
    containerParams.video_url = post.mediaUrl
  } else if (post.mediaUrl) {
    containerParams.image_url = post.mediaUrl
  } else {
    throw new Error("Instagram: media URL required")
  }

  const containerRes = await fetch(
    `https://graph.facebook.com/v19.0/${account.pageId}/media`,
    {
      method: "POST",
      body: new URLSearchParams(containerParams),
    }
  )
  const container = await containerRes.json()
  if (container.error) throw new Error(container.error.message)
  if (!container.id) throw new Error("Instagram: container creation returned no ID")

  // Poll until container is FINISHED (Instagram needs time to process the image)
  let attempts = 0
  while (attempts < 10) {
    await new Promise(r => setTimeout(r, 3000))
    const statusRes = await fetch(
      `https://graph.facebook.com/v19.0/${container.id}?fields=status_code&access_token=${account.accessToken}`
    )
    const statusData = await statusRes.json()
    if (statusData.status_code === "FINISHED") break
    if (statusData.status_code === "ERROR" || statusData.status_code === "EXPIRED") {
      throw new Error(`Instagram container processing failed: ${statusData.status_code}`)
    }
    attempts++
  }
  if (attempts >= 10) throw new Error("Instagram: container did not finish processing in time")

  const publishRes = await fetch(
    `https://graph.facebook.com/v19.0/${account.pageId}/media_publish`,
    {
      method: "POST",
      body: new URLSearchParams({
        creation_id: container.id,
        access_token: account.accessToken,
      }),
    }
  )
  const published = await publishRes.json()
  if (published.error) throw new Error(published.error.message)
  return published.id as string
}

async function publishToTikTok(account: AccountLike, post: PostLike): Promise<string> {
  if (!account.accessToken) throw new Error("TikTok: missing access token")

  const res = await fetch("https://open.tiktokapis.com/v2/post/publish/text/init/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${account.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title: post.content.slice(0, 150),
        privacy_level: "PUBLIC_TO_EVERYONE",
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: 0,
        chunk_size: 0,
        total_chunk_count: 0,
      },
    }),
  })
  const data = await res.json()
  if (data.error?.code !== "ok") throw new Error(data.error?.message ?? "TikTok publish failed")
  return data.data?.publish_id as string
}

async function publishToLinkedIn(account: AccountLike, post: PostLike): Promise<string> {
  if (!account.accessToken || !account.accountId) throw new Error("LinkedIn: missing credentials")

  const text = post.mediaUrl
    ? `${post.content}\n\n${post.mediaUrl}`
    : post.content

  const body = {
    author: `urn:li:person:${account.accountId}`,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  }

  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${account.accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (data.status && data.status >= 400) throw new Error(data.message ?? "LinkedIn publish failed")
  return data.id as string
}

async function publishToYouTube(account: AccountLike, post: PostLike): Promise<string> {
  if (!account.refreshToken) throw new Error("YouTube: missing refresh token — re-authorize via Accounts tab")
  if (!post.mediaUrl) throw new Error("YouTube: no video URL to upload")
  // Guard: only upload actual video files — reject images passed by mistake
  const looksLikeImage = /\.(png|jpg|jpeg|webp|gif|svg)(\?|$)/i.test(post.mediaUrl)
  if (looksLikeImage) throw new Error("YouTube: mediaUrl is an image, not a video — skipping to avoid failed upload")

  // Parse YouTube metadata stored in the prompt field
  let youtubeTitle = `Mercado Inmobiliario Miami ${new Date().getFullYear()} — Catherine Gomez Realtor`
  let youtubeDescription = post.content
  let youtubeTags: string[] = ["miami real estate", "catherine gomez realtor", "brickell miami", "south florida real estate"]

  try {
    const meta = JSON.parse(post.prompt ?? "{}")
    if (meta.youtubeTitle) youtubeTitle = meta.youtubeTitle
    if (meta.youtubeDescription) youtubeDescription = meta.youtubeDescription
    if (Array.isArray(meta.youtubeTags) && meta.youtubeTags.length > 0) youtubeTags = meta.youtubeTags
  } catch {
    // prompt not JSON — use defaults
  }

  const youtubeUrl = await uploadVideoToYouTube({
    videoUrl: post.mediaUrl,
    title: youtubeTitle,
    description: youtubeDescription,
    tags: youtubeTags,
    refreshToken: account.refreshToken,
  })

  if (!youtubeUrl) throw new Error("YouTube: upload returned null — check credentials and video URL")
  return youtubeUrl
}

export async function publishPost(post: PostLike, account: AccountLike): Promise<void> {
  let externalId: string | undefined

  try {
    if (post.platform === "FACEBOOK") {
      externalId = await publishToFacebook(account, post)
    } else if (post.platform === "INSTAGRAM") {
      externalId = await publishToInstagram(account, post)
    } else if (post.platform === "TIKTOK") {
      externalId = await publishToTikTok(account, post)
    } else if (post.platform === "LINKEDIN") {
      externalId = await publishToLinkedIn(account, post)
    } else if (post.platform === "YOUTUBE") {
      externalId = await publishToYouTube(account, post)
    } else {
      console.log(`[social-autopilot] Skipping unsupported platform: ${post.platform}`)
      return
    }

    await prisma.socialPost.update({
      where: { id: post.id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        externalId,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[social-autopilot] Publish failed for ${post.platform} (post ${post.id}): ${msg}`)
    await prisma.socialPost.update({
      where: { id: post.id },
      data: { status: "FAILED", errorMessage: msg.slice(0, 500) },
    })
  }
}

// ─── runAutopilot — main entry point ─────────────────────────────────────────

export interface AutopilotResult {
  posted: number
  failed: number
  videoQueued: number
  skipped: number
  heygenError?: string
}

export async function triggerVideoOnly(): Promise<{ videoId: string | null; error?: string }> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) return { videoId: null, error: "HEYGEN_API_KEY not set" }

  try {
    const now = new Date()
    const dayOfWeek = now.getDay()
    let research: ResearchBrief | undefined
    try { research = await researchViralContent(dayOfWeek) } catch { /* use defaults */ }

    const videoScript = await generateVideoScript(dayOfWeek, research)
    const videoId = await triggerHeyGenVideo(videoScript, dayOfWeek)

    if (!videoId) return { videoId: null, error: "HeyGen returned no video_id — check Railway logs" }

    // Store a pending SocialPost record for each connected account so checkHeygenVideos can publish it later
    const accounts = await prisma.socialAccount.findMany({ where: { isConnected: true } })
    const promptMeta = research ? JSON.stringify({ theme: research.trendingTopic, youtubeTitle: research.youtubeTitle, youtubeDescription: research.youtubeDescription, youtubeTags: research.youtubeTags }) : "manual video trigger"

    for (const account of accounts) {
      const content = await generateContent(account.platform, dayOfWeek, research)
      await prisma.socialPost.create({
        data: {
          platform: account.platform,
          content,
          postType: "POST",
          status: "GENERATING_VIDEO",
          scheduledAt: now,
          aiGenerated: true,
          accountId: account.id,
          externalId: videoId,
          prompt: promptMeta,
        },
      })
    }

    console.log(`[social-autopilot] Manual video trigger — videoId: ${videoId}, pending posts: ${accounts.length}`)
    return { videoId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[social-autopilot] triggerVideoOnly failed:", err)
    return { videoId: null, error: msg }
  }
}

export async function runAutopilot(slot: "morning" | "evening"): Promise<AutopilotResult> {
  const result: AutopilotResult = { posted: 0, failed: 0, videoQueued: 0, skipped: 0 }

  // 0. Check if auto-pilot is enabled
  const config = await prisma.socialAutoPilotConfig.findFirst()
  if (!config?.isEnabled) {
    console.log("[social-autopilot] Auto-pilot is disabled — skipping")
    return result
  }

  // 1. Get all connected accounts
  const accounts = await prisma.socialAccount.findMany({
    where: { isConnected: true },
  })

  if (accounts.length === 0) {
    console.log("[social-autopilot] No connected accounts — skipping")
    return result
  }

  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sun … 6=Sat

  // 2. Research viral formats for today (non-fatal — falls back gracefully)
  let research: ResearchBrief | undefined
  try {
    research = await researchViralContent(dayOfWeek)
    console.log(`[social-autopilot] Research brief ready — hook: "${research.viralHook}"`)
  } catch (err) {
    console.warn("[social-autopilot] Content research failed, using default themes:", err)
  }

  // 3. Morning slot: auto-publish one blog post per day
  if (slot === "morning") {
    try {
      const blogPublished = await publishBlogPost(dayOfWeek, research)
      if (blogPublished) {
        console.log("[social-autopilot] Blog post published successfully")
      } else {
        console.warn("[social-autopilot] Blog post publish returned false — check logs")
      }
    } catch (err) {
      console.error("[social-autopilot] Blog post publish threw:", err)
    }
  }

  // 4 (was 3). Is this a video slot? Evening + (Tuesday=2 or Friday=5)
  const isVideoSlot = slot === "evening" && (dayOfWeek === 2 || dayOfWeek === 5)
  const heygenConfigured = !!process.env.HEYGEN_API_KEY

  // 5. Pre-generate shared assets (one script + one HeyGen video for all accounts)
  let sharedVideoId: string | null = null

  if (isVideoSlot && heygenConfigured) {
    try {
      const videoScript = await generateVideoScript(dayOfWeek, research)
      sharedVideoId = await triggerHeyGenVideo(videoScript, dayOfWeek)
      if (sharedVideoId) {
        console.log(`[social-autopilot] HeyGen video queued — videoId: ${sharedVideoId}`)
      } else {
        result.heygenError = "triggerHeyGenVideo returned null — check Railway logs for [social-autopilot] HeyGen errors"
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error("[social-autopilot] Video script/HeyGen trigger failed:", err)
      result.heygenError = msg
    }
  } else if (isVideoSlot && !heygenConfigured) {
    result.heygenError = "HEYGEN_API_KEY not set"
  }

  // 6. Build prompt metadata to store with each post (YouTube uses this for title/tags)
  const promptMeta = research
    ? JSON.stringify({
        theme: research.trendingTopic,
        youtubeTitle: research.youtubeTitle,
        youtubeDescription: research.youtubeDescription,
        youtubeTags: research.youtubeTags,
      })
    : DAILY_THEMES[getDayIndex() % DAILY_THEMES.length]

  // 7. Process each connected account independently
  for (const account of accounts) {
    try {
      // YouTube only gets real HeyGen MP4 videos — skip it on non-video slots
      // Also skip if it IS a video slot but HeyGen failed to generate a video
      if (account.platform === "YOUTUBE" && (!isVideoSlot || (isVideoSlot && !sharedVideoId))) {
        if (!isVideoSlot) {
          console.log("[social-autopilot] Skipping YouTube — no video today (use Tue/Fri evening slot)")
        } else {
          console.log("[social-autopilot] Skipping YouTube — HeyGen video generation failed (check avatar setup)")
        }
        result.skipped++
        continue
      }
      // 7a. Generate platform-specific content (research-enriched + AIO optimized)
      const content = await generateContent(account.platform, dayOfWeek, research)

      // 7b. Determine media handling
      let mediaUrl: string | null = null
      let postStatus = "SCHEDULED"
      let externalId: string | null = null
      let useVideoFlow = false

      if (isVideoSlot && heygenConfigured && sharedVideoId) {
        externalId = sharedVideoId
        postStatus = "GENERATING_VIDEO"
        useVideoFlow = true
      }

      if (!useVideoFlow) {
        // Generate image with gpt-image-1 → Cloudinary
        // Fall back to a curated Unsplash Miami real estate photo if AI generation fails
        mediaUrl = await generateAndUploadImage(dayOfWeek, research)
        if (!mediaUrl) {
          const FALLBACK_IMAGES = [
            "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1080&q=80",
            "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1080&q=80",
            "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1080&q=80",
            "https://images.unsplash.com/photo-1613977257365-aaae5a9817ff?w=1080&q=80",
            "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1080&q=80",
          ]
          mediaUrl = FALLBACK_IMAGES[dayOfWeek % FALLBACK_IMAGES.length]
          console.log("[social-autopilot] Using fallback Unsplash image (AI image generation failed)")
        }
      }

      // 7c. Create SocialPost record
      const post = await prisma.socialPost.create({
        data: {
          platform: account.platform,
          content,
          mediaUrl,
          postType: "POST",
          status: postStatus,
          scheduledAt: now,
          aiGenerated: true,
          accountId: account.id,
          externalId,
          prompt: promptMeta,
        },
      })

      if (useVideoFlow) {
        result.videoQueued++
        console.log(`[social-autopilot] Video queued for ${account.platform} (videoId: ${externalId})`)
      } else {
        // Publish immediately
        await publishPost(post, account)

        const updated = await prisma.socialPost.findUnique({ where: { id: post.id } })
        if (updated?.status === "PUBLISHED") {
          result.posted++
        } else {
          result.failed++
        }
      }
    } catch (err) {
      console.error(
        `[social-autopilot] Failed to process account ${account.platform} (${account.id}):`,
        err
      )
      result.failed++
    }
  }

  console.log(`[social-autopilot] Done — slot=${slot} day=${dayOfWeek}`, result)
  return result
}
