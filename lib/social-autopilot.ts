/**
 * Social Media Auto-Pilot — Catherine Gomez Realtor
 *
 * Runs twice daily via Railway cron:
 *   Morning slot (9 AM ET)  — image + text posts on all connected platforms
 *   Evening slot (6 PM ET)  — HeyGen video on Tue/Fri, otherwise image + text
 */

import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { v2 as cloudinary } from "cloudinary"
import { prisma } from "@/lib/prisma"

// ─── SDK init ────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// ─── Weekly theme rotation ────────────────────────────────────────────────────

const WEEKLY_THEMES: Record<number, string> = {
  0: "actualización del mercado inmobiliario de Miami",
  1: "consejos para compradores de primera vez en Miami",
  2: "inversión en pre-construcción en Brickell y South Florida",
  3: "barrio destacado — Homestead, Orlando o Brickell",
  4: "generar ingresos con Airbnb en Miami — inversión inteligente",
  5: "historia de éxito — cómo ayudé a un cliente a comprar en Miami",
  6: "consejo del fin de semana para compradores e inversores",
}

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
]

function pickKeywords(dayOfWeek: number): string[] {
  // Rotate 2-3 keywords deterministically per day
  const start = (dayOfWeek * 3) % SEO_KEYWORDS.length
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
}

// ─── Content generation with Claude ──────────────────────────────────────────

async function generateContent(platform: string, dayOfWeek: number): Promise<string> {
  const theme = WEEKLY_THEMES[dayOfWeek] ?? WEEKLY_THEMES[0]
  const keywords = pickKeywords(dayOfWeek)
  const platformGuide = PLATFORM_GUIDES[platform] ?? PLATFORM_GUIDES.FACEBOOK

  const systemPrompt = `Eres Catherine Gomez, Realtor en Miami con más de 15 años de experiencia en el mercado inmobiliario de South Florida. Escribes en primera persona, siempre en español, con autenticidad y expertise. Nunca usas frases genéricas o de relleno. Tu audiencia son compradores e inversores hispanohablantes.`

  const userPrompt = `Escribe un post de redes sociales sobre el tema del día: ${theme}.

Palabras clave SEO que DEBES incluir de forma natural en el post (2-3 de ellas): ${keywords.join(", ")}.

${platformGuide}

Escribe SOLO el contenido del post, listo para publicar. Sin explicaciones, sin preámbulos, sin etiquetas como "Post:" o "Caption:". Solo el texto del post.`

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  })

  const content = message.content[0].type === "text" ? message.content[0].text : ""
  return content.trim()
}

// ─── Image generation with DALL-E → Cloudinary ───────────────────────────────

async function generateAndUploadImage(dayOfWeek: number): Promise<string | null> {
  const theme = WEEKLY_THEMES[dayOfWeek] ?? WEEKLY_THEMES[0]

  try {
    const imagePrompt = `Professional Miami real estate photography, theme: ${theme}. Luxury properties, blue sky, palm trees, modern architecture. Photorealistic, bright daylight, no text or watermarks.`

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    })

    const imageUrl = response.data?.[0]?.url
    if (!imageUrl) return null

    // Download the image bytes
    const fetchRes = await fetch(imageUrl)
    if (!fetchRes.ok) return null
    const buffer = await fetchRes.arrayBuffer()
    const base64 = Buffer.from(buffer).toString("base64")

    // Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(
      `data:image/png;base64,${base64}`,
      { folder: "lofty-social" }
    )

    return uploadResult.secure_url
  } catch (err) {
    console.error("[social-autopilot] Image generation/upload failed:", err)
    return null
  }
}

// ─── HeyGen video generation ──────────────────────────────────────────────────

async function generateVideoScript(dayOfWeek: number): Promise<string> {
  const theme = WEEKLY_THEMES[dayOfWeek] ?? WEEKLY_THEMES[0]
  const keywords = pickKeywords(dayOfWeek)

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: `Eres Catherine Gomez, Realtor en Miami. Escribes scripts de video cortos en español, naturales para hablar en cámara.`,
    messages: [
      {
        role: "user",
        content: `Escribe un script de video de 50 segundos (aproximadamente 120-130 palabras) sobre: ${theme}.
Incluye de forma natural: ${keywords.slice(0, 2).join(", ")}.
El tono es cercano, profesional y directo. Termina con una CTA hablada (ej: "escríbeme al…" o "visita mi perfil").
Escribe SOLO el texto que dirá la persona en el video. Sin acotaciones de escena, sin instrucciones, sin corchetes.`,
      },
    ],
  })

  return message.content[0].type === "text" ? message.content[0].text.trim() : ""
}

async function getHeyGenAvatar(): Promise<{ avatarId: string; voiceId: string } | null> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) return null

  try {
    const [avatarsRes, voicesRes] = await Promise.all([
      fetch("https://api.heygen.com/v2/avatars", {
        headers: { "X-Api-Key": apiKey },
      }),
      fetch("https://api.heygen.com/v2/voices", {
        headers: { "X-Api-Key": apiKey },
      }),
    ])

    const avatarsData = await avatarsRes.json()
    const voicesData = await voicesRes.json()

    // Get first available avatar (avatars + talking_photos combined)
    const avatars: Array<{ avatar_id: string }> = [
      ...(avatarsData?.data?.avatars ?? []),
      ...(avatarsData?.data?.talking_photos ?? []),
    ]
    const avatarId = avatars[0]?.avatar_id
    if (!avatarId) return null

    // Filter for Spanish voices, fallback to first available
    const voices: Array<{ voice_id: string; language?: string; locale?: string }> =
      voicesData?.data?.voices ?? []
    const spanishVoice = voices.find(
      v => v.language?.toLowerCase().includes("es") || v.locale?.toLowerCase().includes("es")
    )
    const voiceId = spanishVoice?.voice_id ?? voices[0]?.voice_id
    if (!voiceId) return null

    return { avatarId, voiceId }
  } catch (err) {
    console.error("[social-autopilot] HeyGen avatar/voice fetch failed:", err)
    return null
  }
}

async function triggerHeyGenVideo(script: string): Promise<string | null> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) return null

  try {
    const avatarInfo = await getHeyGenAvatar()
    if (!avatarInfo) return null

    const payload = {
      video_inputs: [
        {
          character: {
            type: "avatar",
            avatar_id: avatarInfo.avatarId,
            avatar_style: "normal",
          },
          voice: {
            type: "text",
            input_text: script,
            voice_id: avatarInfo.voiceId,
          },
          background: {
            type: "color",
            value: "#1E3A5F",
          },
        },
      ],
      dimension: { width: 1080, height: 1920 },
      aspect_ratio: "9:16",
    }

    const res = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    return (data?.data?.video_id as string) ?? null
  } catch (err) {
    console.error("[social-autopilot] HeyGen video generation failed:", err)
    return null
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
          await publishPost(post, post.account)
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
  pageId: string | null
}

type PostLike = {
  id: string
  platform: string
  content: string
  mediaUrl: string | null
}

async function publishToFacebook(account: AccountLike, post: PostLike): Promise<string> {
  if (!account.accessToken || !account.pageId) throw new Error("Facebook: missing credentials")

  const isVideo = !!(post.mediaUrl?.includes(".mp4") || post.mediaUrl?.includes("video"))
  const endpoint = isVideo
    ? `https://graph.facebook.com/v19.0/${account.pageId}/videos`
    : `https://graph.facebook.com/v19.0/${account.pageId}/feed`

  const body: Record<string, string> = {
    message: post.content,
    access_token: account.accessToken,
  }
  if (post.mediaUrl) {
    body[isVideo ? "file_url" : "link"] = post.mediaUrl
  }

  const res = await fetch(endpoint, {
    method: "POST",
    body: new URLSearchParams(body),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data.id as string
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
    } else {
      // TWITTER/X and others — skip
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
    console.error(`[social-autopilot] Publish failed for ${post.platform} (post ${post.id}):`, err)
    await prisma.socialPost.update({
      where: { id: post.id },
      data: { status: "FAILED" },
    })
  }
}

// ─── runAutopilot — main entry point ─────────────────────────────────────────

export interface AutopilotResult {
  posted: number
  failed: number
  videoQueued: number
  skipped: number
}

export async function runAutopilot(slot: "morning" | "evening"): Promise<AutopilotResult> {
  const result: AutopilotResult = { posted: 0, failed: 0, videoQueued: 0, skipped: 0 }

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

  // 2. Is this a video slot? Evening + (Tuesday=2 or Friday=5)
  const isVideoSlot = slot === "evening" && (dayOfWeek === 2 || dayOfWeek === 5)
  const heygenConfigured = !!process.env.HEYGEN_API_KEY

  // 3. Pre-generate video script once (shared across accounts on video days)
  let videoScript: string | null = null
  if (isVideoSlot && heygenConfigured) {
    try {
      videoScript = await generateVideoScript(dayOfWeek)
    } catch (err) {
      console.error("[social-autopilot] Video script generation failed:", err)
    }
  }

  // 4. Process each connected account independently
  for (const account of accounts) {
    try {
      // 4a. Generate platform-specific content
      const content = await generateContent(account.platform, dayOfWeek)

      // 4b. Determine media handling
      let mediaUrl: string | null = null
      let postStatus = "SCHEDULED"
      let externalId: string | null = null
      let useVideoFlow = false

      if (isVideoSlot && heygenConfigured && videoScript) {
        try {
          const videoId = await triggerHeyGenVideo(videoScript)
          if (videoId) {
            externalId = videoId
            postStatus = "GENERATING_VIDEO"
            useVideoFlow = true
          }
        } catch (err) {
          console.error("[social-autopilot] HeyGen trigger failed, falling back to image:", err)
        }
      }

      if (!useVideoFlow) {
        // Generate image with DALL-E → Cloudinary (failures are non-fatal)
        mediaUrl = await generateAndUploadImage(dayOfWeek)
      }

      // 4c. Create SocialPost record
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
          prompt: WEEKLY_THEMES[dayOfWeek],
        },
      })

      if (useVideoFlow) {
        // Video is being generated async — checkHeygenVideos will publish it later
        result.videoQueued++
        console.log(
          `[social-autopilot] Video queued for ${account.platform} (videoId: ${externalId})`
        )
      } else {
        // Publish immediately
        await publishPost(post, account)

        // Re-fetch to check final status
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
