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
import { fetchSceneVideoUrl, getFallbackBackground } from "./pexels-video"
import { generateGuideFromScript } from "./generate-guide"

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
  research?: ResearchBrief,
  blogUrl?: string | null
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

  const blogInstruction = blogUrl
    ? `\n\nAl final del post, invita a leer el artículo completo con esta línea (OBLIGATORIO — incluye el link exacto):\n👉 Lee el artículo completo aquí: ${blogUrl}`
    : ""

  const userPrompt = `Escribe un post de redes sociales sobre el tema del día: ${theme}.${hookInstruction}

Palabras clave SEO que DEBES incluir de forma natural (2-3 de ellas): ${keywords.join(", ")}.

Audiencia objetivo: ${research?.targetAudience ?? "compradores e inversores hispanohablantes en South Florida"}.

${platformGuide}
${blogInstruction}

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

// ─── Image deduplication helpers ─────────────────────────────────────────────

// 20-image fallback pool covering diverse Miami property types
const FALLBACK_IMAGES = [
  // Luxury homes with pools
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1080&q=80",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1080&q=80",
  "https://images.unsplash.com/photo-1613977257365-aaae5a9817ff?w=1080&q=80",
  "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1080&q=80",
  // Modern home exteriors
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1080&q=80",
  "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1080&q=80",
  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1080&q=80",
  "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=1080&q=80",
  "https://images.unsplash.com/photo-1600047508788-786f3865b911?w=1080&q=80",
  "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=1080&q=80",
  // Miami skyline / condo towers
  "https://images.unsplash.com/photo-1533106497176-45ae19e68ba2?w=1080&q=80",
  "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1080&q=80",
  // Luxury interiors
  "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1080&q=80",
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1080&q=80",
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1080&q=80",
  "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1080&q=80",
  // Additional luxury homes — varied angles
  "https://images.unsplash.com/photo-1449844908441-8829872d2607?w=1080&q=80",
  "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1080&q=80",
  "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1080&q=80",
  "https://images.unsplash.com/photo-1541123437800-1bb1317badc2?w=1080&q=80",
]

async function getRecentlyUsedMediaUrls(): Promise<Set<string>> {
  const since = new Date(Date.now() - 30 * 86400000)
  const posts = await prisma.socialPost.findMany({
    where: { mediaUrl: { not: null }, publishedAt: { gte: since } },
    select: { mediaUrl: true },
  })
  return new Set(posts.map(p => p.mediaUrl!).filter(Boolean))
}

function pickUnusedFallback(usedUrls: Set<string>): string {
  const unused = FALLBACK_IMAGES.filter(url => !usedUrls.has(url))
  const pool = unused.length > 0 ? unused : FALLBACK_IMAGES
  return pool[Math.floor(Math.random() * pool.length)]
}

// Photo variety arrays to make each DALL-E prompt unique
const PHOTO_ANGLES = [
  "aerial drone perspective", "street-level view", "golden hour twilight shot",
  "poolside view looking up", "rooftop terrace vantage point",
  "wide-angle interior living area", "balcony view of city skyline",
  "driveway approach shot", "garden patio perspective",
]

const PHOTO_SUBJECTS = [
  "Brickell high-rise luxury condo", "Coral Gables Mediterranean estate",
  "Doral family home with pool", "Coconut Grove waterfront villa",
  "Aventura oceanfront high-rise", "Homestead modern suburban home",
  "Edgewater bay-view apartment building", "South Beach Art Deco property",
  "Key Biscayne luxury waterfront home", "Wynwood modern loft building",
  "Sunny Isles Beach tower", "Kendall single-family home with palm trees",
]

// ─── Image generation with DALL-E → Cloudinary ───────────────────────────────

async function generateAndUploadImage(
  dayOfWeek: number,
  research?: ResearchBrief,
  usedUrls = new Set<string>()
): Promise<string | null> {
  const theme = research?.trendingTopic ?? DAILY_THEMES[getDayIndex() % DAILY_THEMES.length]

  try {
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10)
    const angle = PHOTO_ANGLES[Math.floor(Math.random() * PHOTO_ANGLES.length)]
    const subject = PHOTO_SUBJECTS[Math.floor(Math.random() * PHOTO_SUBJECTS.length)]

    const imagePrompt = `Professional South Florida real estate photography. Subject: ${subject}. Perspective: ${angle}. Thematic context: ${theme}. Clear blue sky, lush tropical landscaping, modern architecture, bright natural daylight. Ultra-realistic, no text, no watermarks, no people. Date reference: ${dateStr}.`

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
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
  const keywords = research?.additionalKeywords?.slice(0, 3) ?? pickKeywords(dayOfWeek)
  const hook = research?.viralHook

  const hookLine = hook
    ? `\nUSA ESTA PRIMERA LÍNEA EXACTA o muy similar (es el hook viral): "${hook}"`
    : ""

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    system: `Eres la estratega de contenido viral de Catherine Gomez, Realtor en Miami con 15 años en South Florida.
Escribes scripts de video SHORT-FORM (TikTok/Reels/YouTube Shorts) que:
1. PARAN el scroll en los primeros 3 segundos — hook impactante, pregunta o dato que nadie espera
2. Crean tensión narrativa que retiene al espectador hasta el CTA final
3. Incluyen keywords habladas para SEO de audio (YouTube transcribe cada palabra)
4. Responden preguntas específicas que ChatGPT y Perplexity listarían como respuesta experta (AIO)
5. Terminan con un CTA de comentario muy específico que genera engagement medible

Catherine habla en español natural, primera persona, tono cercano y de autoridad real. Nunca genérica.`,
    messages: [
      {
        role: "user",
        content: `Escribe un script de video de EXACTAMENTE 4 escenas sobre: "${theme}".${hookLine}

ESTRUCTURA OBLIGATORIA — separa cada escena con una línea en blanco:

ESCENA 1 - HOOK (20-25 palabras):
Pregunta impactante O dato sorprendente O afirmación contraintuitiva. Ejemplo: "¿Sabías que el 70% de los colombianos que compraron en Miami hace 5 años ya duplicaron su inversión?" — la primera oración decide si el espectador se queda o hace scroll.

ESCENA 2 - PROBLEMA/TENSIÓN (25-30 palabras):
El dolor real: por qué este problema le está costando dinero al espectador AHORA MISMO. Crea urgencia.

ESCENA 3 - SOLUCIÓN + CREDENCIAL (45-55 palabras):
Empieza con "Soy Catherine Gomez, Realtor en Miami." + dato específico del mercado de South Florida que demuestra expertise + exactamente cómo ella resuelve este problema para familias hispanas. Incluye naturalmente: ${keywords.join(", ")}.

ESCENA 4 - CTA ESPECÍFICO (20-25 palabras):
"Comenta '[KEYWORD]' abajo" donde [KEYWORD] es UNA PALABRA en español todo en mayúsculas que resuma el tema del video (ejemplos: INVERSIÓN, CREDITO, HIPOTECA, CALIFICA, VENDEDOR, RENTAR, MIAMI — inventa la que sea más relevante para este guión específico). Explica exactamente qué van a recibir (guía gratis, los números reales, paso a paso).

Devuelve SOLO las 4 escenas en texto corrido. Sin etiquetas "ESCENA X", sin corchetes, sin acotaciones. Solo el texto que Catherine dice, separado por una línea en blanco entre cada escena.`,
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


// Scene 0 = avatar intro (short hook), scenes 1+ = b-roll segments.
function splitScriptForBRoll(script: string): string[] {
  const byBlankLine = script
    .split(/\n\n+/)
    .map(s => s.replace(/\n/g, " ").trim())
    .filter(s => s.length > 10)
  if (byBlankLine.length >= 2 && byBlankLine.length <= 5) return byBlankLine.slice(0, 4)

  const sentences = script.split(/(?<=[.!?¡])\s+/).filter(s => s.trim().length > 0)
  if (sentences.length <= 2) return [script]

  // Scene 0: first 1-2 sentences as the avatar hook
  const hookEnd = Math.min(2, Math.ceil(sentences.length * 0.3))
  const hook = sentences.slice(0, hookEnd).join(" ").trim()
  const rest = sentences.slice(hookEnd)

  // Remaining: 2-3 b-roll segments
  const brollCount = Math.min(3, Math.max(1, Math.ceil(rest.length / 2)))
  const perScene = Math.ceil(rest.length / brollCount)
  const brolls: string[] = []
  for (let i = 0; i < brollCount; i++) {
    const chunk = rest.slice(i * perScene, (i + 1) * perScene).join(" ").trim()
    if (chunk) brolls.push(chunk)
  }
  return [hook, ...brolls]
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

    // Structure: avatar intro → b-roll scenes → avatar outro
    const scenes = splitScriptForBRoll(script)
    const videoUrls = await Promise.all(
      scenes.map((sceneText, i) =>
        i === 0 || i === scenes.length - 1
          ? Promise.resolve(null)
          : fetchSceneVideoUrl(sceneText, "portrait")
      )
    )

    const videoInputs = scenes.map((sceneText, i) => {
      const isFirst = i === 0
      const isLast = i === scenes.length - 1
      if (isFirst || isLast) {
        return {
          character,
          voice: { type: "text", input_text: sceneText, voice_id: avatarInfo.voiceId },
          background: getFallbackBackground(sceneText, i),
        }
      }
      const videoUrl = videoUrls[i]
      return {
        voice: { type: "text", input_text: sceneText, voice_id: avatarInfo.voiceId },
        background: videoUrl
          ? { type: "video", url: videoUrl, play_style: "fit_to_scene" }
          : getFallbackBackground(sceneText, i),
      }
    })

    const payload = {
      video_inputs: videoInputs,
      dimension: { width: 720, height: 1280 },
      caption: true,
    }

    const brollCount = Math.max(0, scenes.length - 2)
    console.log(`[social-autopilot] HeyGen — avatar intro + ${brollCount} B-roll + avatar outro, Pexels: ${videoUrls.filter(Boolean).length}/${brollCount}, avatar: ${avatarInfo.avatarId.slice(0, 8)}`)

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
      console.log(`[social-autopilot] HeyGen generate success — video_id: ${data.data.video_id}, scenes: ${scenes.length}`)
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
      max_tokens: 4096,
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
  const BLOG_FALLBACKS = [
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1080&q=80",
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1080&q=80",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1080&q=80",
    "https://images.unsplash.com/photo-1613977257365-aaae5a9817ff?w=1080&q=80",
    "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1080&q=80",
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1080&q=80",
    "https://images.unsplash.com/photo-1449844908441-8829872d2607?w=1080&q=80",
  ]
  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: `Professional Miami real estate photography. ${prompt}. Luxury properties, blue sky, palm trees, modern architecture. Photorealistic, bright daylight, no text or watermarks.`,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
    } as any)

    const b64 = (response.data as any[])?.[0]?.b64_json
    if (!b64) {
      console.warn("[social-autopilot] DALL-E returned no b64_json, using fallback")
      return BLOG_FALLBACKS[Math.floor(Math.random() * BLOG_FALLBACKS.length)]
    }

    const uploadResult = await cloudinary.uploader.upload(
      `data:image/png;base64,${b64}`,
      { folder }
    )

    return uploadResult.secure_url
  } catch (err) {
    console.error("[social-autopilot] Section image generation failed:", err)
    return BLOG_FALLBACKS[Math.floor(Math.random() * BLOG_FALLBACKS.length)]
  }
}

async function publishBlogPost(dayOfWeek: number, research?: ResearchBrief): Promise<{ slug: string; title: string; coverImage: string | null } | null> {
  try {
    const data = await generateBlogPostContent(dayOfWeek, research)
    if (!data) return null

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
    return { slug, title: data.title, coverImage: coverImage ?? null }
  } catch (err) {
    console.error("[social-autopilot] Blog post publish failed:", err)
    return null
  }
}

export async function publishBlogPostOnly(): Promise<{ ok: boolean; title?: string; error?: string }> {
  const now = new Date()
  const dayOfWeek = now.getDay()
  let research: ResearchBrief | undefined
  try { research = await researchViralContent(dayOfWeek) } catch {}
  try {
    const data = await generateBlogPostContent(dayOfWeek, research)
    if (!data) return { ok: false, error: "Content generation returned null" }

    const theme = research?.trendingTopic ?? DAILY_THEMES[getDayIndex() % DAILY_THEMES.length]
    const coverPrompt = `${theme}, luxurious Miami waterfront property, golden hour`
    const [coverImage, sectionImg1, sectionImg2] = await Promise.all([
      generateSectionImage(coverPrompt, "lofty-blog"),
      data.sectionImagePrompts?.[0] ? generateSectionImage(data.sectionImagePrompts[0], "lofty-blog") : Promise.resolve(null),
      data.sectionImagePrompts?.[1] ? generateSectionImage(data.sectionImagePrompts[1], "lofty-blog") : Promise.resolve(null),
    ])

    let html = data.content
    html = sectionImg1
      ? html.replace("[IMG_SECTION_1]", `<figure class="my-8 rounded-2xl overflow-hidden shadow-md"><img src="${sectionImg1}" alt="${data.title}" class="w-full object-cover max-h-80" loading="lazy" /></figure>`)
      : html.replace("[IMG_SECTION_1]", "")
    html = sectionImg2
      ? html.replace("[IMG_SECTION_2]", `<figure class="my-8 rounded-2xl overflow-hidden shadow-md"><img src="${sectionImg2}" alt="${data.title}" class="w-full object-cover max-h-80" loading="lazy" /></figure>`)
      : html.replace("[IMG_SECTION_2]", "")

    const baseSlug = data.title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    const slug = `${baseSlug}-${Date.now()}`

    await prisma.blogPost.create({
      data: { title: data.title, slug, excerpt: data.excerpt, content: html, coverImage, author: "Catherine Gomez", tags: JSON.stringify(data.tags), featured: false, published: true, publishedAt: new Date() },
    })
    console.log(`[social-autopilot] Blog-only post published: "${data.title}"`)
    return { ok: true, title: data.title }
  } catch (err: any) {
    console.error("[social-autopilot] Blog-only publish failed:", err)
    return { ok: false, error: err?.message ?? String(err) }
  }
}

export async function shareBlogOnSocial(
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

        let postContent =
          message.content[0].type === "text"
            ? message.content[0].text.trim()
            : `📖 Nuevo artículo: ${title}\n\n${excerpt}\n\n👉 Leer más: ${blogUrl}`

        // Always guarantee the full URL appears at the end — Claude sometimes truncates long slugs
        if (!postContent.includes(blogUrl)) {
          // Remove any partial/truncated version of the URL Claude may have written
          postContent = postContent.replace(/https?:\/\/\S+/g, "").trimEnd()
          postContent = `${postContent}\n\n👉 ${blogUrl}`
        }

        const fakePost: PostLike = {
          id: `blog-share-${Date.now()}`,
          platform: account.platform,
          content: postContent,
          mediaUrl: coverImage,
          prompt: null,
        }

        let blogPostExternalId: string | null = null
        if (account.platform === "FACEBOOK") {
          blogPostExternalId = await publishToFacebook(account, fakePost)
        } else if (account.platform === "INSTAGRAM" && coverImage) {
          blogPostExternalId = await publishToInstagram(account, fakePost)
        }

        // Auto-comment for engagement
        if (blogPostExternalId && account.accessToken) {
          const comment = await generateEngagementComment(account.platform, postContent)
          if (account.platform === "FACEBOOK") postFacebookComment(blogPostExternalId, account.accessToken, comment)
          else postInstagramComment(blogPostExternalId, account.accessToken, comment)
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

// ─── checkHeygenVideos — polls HeyGen → Creatomate captions → publish ────────

export async function checkHeygenVideos(): Promise<{ checked: number; completed: number }> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) return { checked: 0, completed: 0 }

  const creatomateKey = process.env.CREATOMATE_API_KEY
  let checked = 0
  let completed = 0

  // ── Step A: HeyGen → Creatomate (or direct publish if no Creatomate key) ──
  const heygenPending = await prisma.socialPost.findMany({
    where: { status: "GENERATING_VIDEO", externalId: { not: null } },
    include: { account: true },
  })
  checked += heygenPending.length

  for (const post of heygenPending) {
    try {
      const res = await fetch(
        `https://api.heygen.com/v1/video_status.get?video_id=${post.externalId}`,
        { headers: { "X-Api-Key": apiKey } }
      )
      const data = await res.json()
      const heygenStatus: string | undefined = data?.data?.status
      const videoUrl: string | undefined = data?.data?.video_url

      if (heygenStatus === "completed" && videoUrl) {
        if (creatomateKey) {
          // Pipe through Creatomate for kinetic captions before publishing
          const ctRes = await fetch("https://api.creatomate.com/v1/renders", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${creatomateKey}` },
            body: JSON.stringify({
              source: {
                output_format: "mp4",
                frame_rate: 30,
                width: 720,
                height: 1280,
                elements: [
                  { id: "main-video", type: "video", source: videoUrl, fit: "cover", time: 0, duration: "auto" },
                  {
                    type: "text",
                    transcript: true,
                    transcript_source: "main-video",
                    transcript_effect: "highlight",
                    transcript_placement: "word",
                    transcript_highlight_color: "#FFD700",
                    font_family: "Montserrat",
                    font_weight: "800",
                    font_size: "7.5vh",
                    fill_color: "#FFFFFF",
                    stroke_color: "#000000",
                    stroke_width: "0.04em",
                    text_transform: "uppercase",
                    x: "50%",
                    y: "82%",
                    width: "88%",
                    height: "auto",
                  },
                ],
              },
            }),
          })
          const ctData = await ctRes.json()
          const ctRender = Array.isArray(ctData) ? ctData[0] : ctData
          if (ctRender?.id) {
            await prisma.socialPost.update({
              where: { id: post.id },
              data: { status: "CAPTIONS_PENDING", externalId: `cm_${ctRender.id}`, mediaUrl: videoUrl },
            })
            console.log(`[social-autopilot] HeyGen done → Creatomate captions started (${ctRender.id}) for post ${post.id}`)
          } else {
            // Creatomate submission failed — publish raw HeyGen video as fallback
            console.warn("[social-autopilot] Creatomate submission failed, publishing HeyGen video directly")
            await prisma.socialPost.update({ where: { id: post.id }, data: { status: "SCHEDULED", mediaUrl: videoUrl } })
            if (post.account) await publishPost({ ...post, mediaUrl: videoUrl }, post.account)
            completed++
          }
        } else {
          // No Creatomate key — publish HeyGen video directly
          await prisma.socialPost.update({ where: { id: post.id }, data: { status: "SCHEDULED", mediaUrl: videoUrl } })
          if (post.account) await publishPost({ ...post, mediaUrl: videoUrl }, post.account)
          completed++
        }
      } else if (heygenStatus === "failed") {
        await prisma.socialPost.update({ where: { id: post.id }, data: { status: "FAILED" } })
      }
    } catch (err) {
      console.error(`[social-autopilot] HeyGen check failed for post ${post.id}:`, err)
    }
  }

  // ── Step B: Poll Creatomate renders and publish when done ─────────────────
  if (creatomateKey) {
    const captionsPending = await prisma.socialPost.findMany({
      where: { status: "CAPTIONS_PENDING", externalId: { startsWith: "cm_" } },
      include: { account: true },
    })
    checked += captionsPending.length

    for (const post of captionsPending) {
      try {
        const renderId = post.externalId!.replace(/^cm_/, "")
        const ctRes = await fetch(`https://api.creatomate.com/v1/renders/${renderId}`, {
          headers: { Authorization: `Bearer ${creatomateKey}` },
        })
        const ctData = await ctRes.json()
        const ctRender = Array.isArray(ctData) ? ctData[0] : ctData

        if (ctRender?.status === "succeeded" && ctRender.url) {
          await prisma.socialPost.update({ where: { id: post.id }, data: { status: "SCHEDULED", mediaUrl: ctRender.url } })
          if (post.account) await publishPost({ ...post, mediaUrl: ctRender.url }, post.account)
          console.log(`[social-autopilot] Kinetic captions done → published post ${post.id}`)
          completed++
        } else if (ctRender?.status === "failed") {
          // Creatomate failed — fall back to publishing the raw HeyGen video already stored in mediaUrl
          console.warn(`[social-autopilot] Creatomate render failed for post ${post.id} — publishing HeyGen video as fallback`)
          if (post.account && post.mediaUrl) await publishPost(post, post.account)
          else await prisma.socialPost.update({ where: { id: post.id }, data: { status: "FAILED" } })
          completed++
        }
      } catch (err) {
        console.error(`[social-autopilot] Creatomate caption check failed for post ${post.id}:`, err)
      }
    }
  }

  return { checked, completed }
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

  // Detect video by extension OR common video CDN patterns (HeyGen, Creatomate, etc.)
  const isVideo = !!(
    post.mediaUrl?.match(/\.(mp4|mov|avi|m4v)(\?|$)/i) ||
    post.mediaUrl?.includes("heygen") ||
    post.mediaUrl?.includes("creatomate") ||
    post.mediaUrl?.includes("video")
  )

  const containerParams: Record<string, string> = {
    caption: post.content,
    access_token: account.accessToken,
  }

  if (isVideo && post.mediaUrl) {
    // Instagram requires REELS media_type for video content (VIDEO type is deprecated)
    containerParams.media_type = "REELS"
    containerParams.video_url = post.mediaUrl
    containerParams.share_to_feed = "true"
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
  if (container.error) {
    throw new Error(`Instagram API: ${container.error.message} (code ${container.error.code}, subcode ${container.error.error_subcode ?? "n/a"})`)
  }
  if (!container.id) throw new Error("Instagram: container creation returned no ID")

  // Poll until container is FINISHED — videos can take 30-60s to process
  let attempts = 0
  while (attempts < 20) {
    await new Promise(r => setTimeout(r, 5000))
    const statusRes = await fetch(
      `https://graph.facebook.com/v19.0/${container.id}?fields=status_code,status&access_token=${account.accessToken}`
    )
    const statusData = await statusRes.json()
    console.log(`[instagram] Container ${container.id} status: ${statusData.status_code}`)
    if (statusData.status_code === "FINISHED") break
    if (statusData.status_code === "ERROR" || statusData.status_code === "EXPIRED") {
      throw new Error(`Instagram container failed: ${statusData.status_code} — ${statusData.status ?? "check video URL is publicly accessible"}`)
    }
    attempts++
  }
  if (attempts >= 20) throw new Error("Instagram: video took too long to process — ensure the video URL is a direct public MP4 link")

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
  if (published.error) throw new Error(`Instagram publish: ${published.error.message} (code ${published.error.code})`)
  return published.id as string
}

// ─── Post a comment after publishing (engagement boost) ──────────────────────

export async function postFacebookComment(postId: string, accessToken: string, message: string): Promise<void> {
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${postId}/comments`, {
      method: "POST",
      body: new URLSearchParams({ message, access_token: accessToken }),
    })
    const data = await res.json()
    if (data.error) console.error("[social-autopilot] Facebook comment failed:", data.error.message)
    else console.log(`[social-autopilot] Facebook comment posted on ${postId}`)
  } catch (e) {
    console.error("[social-autopilot] Facebook comment error:", e)
  }
}

export async function postInstagramComment(mediaId: string, accessToken: string, text: string): Promise<void> {
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${mediaId}/comments`, {
      method: "POST",
      body: new URLSearchParams({ message: text, access_token: accessToken }),
    })
    const data = await res.json()
    if (data.error) console.error("[social-autopilot] Instagram comment failed:", data.error.message)
    else console.log(`[social-autopilot] Instagram comment posted on ${mediaId}`)
  } catch (e) {
    console.error("[social-autopilot] Instagram comment error:", e)
  }
}

async function generateEngagementComment(platform: string, postContent: string): Promise<string> {
  try {
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 120,
      messages: [{
        role: "user",
        content: `Escribe UN comentario corto en español (máx 2 oraciones) para publicar justo después de este post en ${platform}. El objetivo es generar engagement: debe hacer UNA pregunta directa al lector o pedirles que comenten algo específico (ej: "¿SÍ o NO?", "Comenta MIAMI", "¿Cuál es tu duda?"). Solo el texto del comentario, sin comillas.\n\nPost: ${postContent.slice(0, 300)}`,
      }],
    })
    return res.content[0].type === "text" ? res.content[0].text.trim() : "¿Tienes preguntas sobre el mercado de Miami? ¡Comenta abajo! 👇"
  } catch {
    return "¿Tienes preguntas sobre el mercado de Miami? ¡Comenta abajo! 👇"
  }
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
      data: { status: "PUBLISHED", publishedAt: new Date(), externalId },
    })

    // Auto-comment for engagement (fire-and-forget, non-fatal)
    if (externalId && account.accessToken && (post.platform === "FACEBOOK" || post.platform === "INSTAGRAM")) {
      const comment = await generateEngagementComment(post.platform, post.content)
      if (post.platform === "FACEBOOK") {
        postFacebookComment(externalId, account.accessToken, comment)
      } else {
        postInstagramComment(externalId, account.accessToken, comment)
      }
    }
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
    generateGuideFromScript(videoScript).catch(e => console.error("[social-autopilot] Guide generation failed:", e))
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

  // 3. Morning slot: publish one blog post and capture its URL for social posts
  let morningBlogUrl: string | null = null
  if (slot === "morning") {
    try {
      const blogResult = await publishBlogPost(dayOfWeek, research)
      if (blogResult) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"
        morningBlogUrl = `${appUrl}/site/blog/${blogResult.slug}`
        console.log(`[social-autopilot] Blog post published: "${blogResult.title}" → ${morningBlogUrl}`)
      } else {
        console.warn("[social-autopilot] Blog post publish returned null — check logs")
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
      generateGuideFromScript(videoScript).catch(e => console.error("[social-autopilot] Guide generation failed:", e))
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

  // 7. Fetch recently used images once — shared across all accounts this run
  const usedMediaUrls = await getRecentlyUsedMediaUrls()

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
      const content = await generateContent(account.platform, dayOfWeek, research, morningBlogUrl)

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
        // Generate unique AI image → Cloudinary, fall back to unused Unsplash photo
        mediaUrl = await generateAndUploadImage(dayOfWeek, research, usedMediaUrls)
        if (!mediaUrl) {
          mediaUrl = pickUnusedFallback(usedMediaUrls)
          console.log("[social-autopilot] Using fallback Unsplash image (AI image generation failed):", mediaUrl)
        }
        // Track this URL so subsequent accounts in the same run don't repeat it
        if (mediaUrl) usedMediaUrls.add(mediaUrl)
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
