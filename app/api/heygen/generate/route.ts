export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

const DIMENSIONS: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1280, height: 720 },
  "9:16": { width: 720, height: 1280 },
  "1:1":  { width: 720, height: 720 },
}

const STYLE_CONFIG: Record<string, { background: Record<string, string> }> = {
  cinematic:  { background: { type: "image", url: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1280&q=80" } },
  thriller:   { background: { type: "image", url: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1280&q=80" } },
  retro_tech: { background: { type: "image", url: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1280&q=80" } },
  pop_culture:{ background: { type: "image", url: "https://images.unsplash.com/photo-1533106497176-45ae19e68ba2?w=1280&q=80" } },
  modern:     { background: { type: "image", url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1280&q=80" } },
  warm:       { background: { type: "image", url: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1280&q=80" } },
  handmade:   { background: { type: "image", url: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1280&q=80" } },
  iconic:     { background: { type: "image", url: "https://images.unsplash.com/photo-1613977257365-aaae5a9817ff?w=1280&q=80" } },
  print:      { background: { type: "image", url: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1280&q=80" } },
}

// Rotating pool of real estate backgrounds for B-Roll scenes
const BROLL_IMAGE_POOL = [
  "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1280&q=80",
  "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1280&q=80",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1280&q=80",
  "https://images.unsplash.com/photo-1533106497176-45ae19e68ba2?w=1280&q=80",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1280&q=80",
  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1280&q=80",
  "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1280&q=80",
  "https://images.unsplash.com/photo-1613977257365-aaae5a9817ff?w=1280&q=80",
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1280&q=80",
]

// Catherine Gomez talking_photo IDs — confirmed by user
const TALKING_PHOTO_IDS = new Set([
  "ab393d45f3044a89b92fc77d17f321b7",
  "28e35d5f82f64101a2584fb29e841a88",
  "ad3b10e46ce44ad8b9a9931f65e151cf",
  "7ec891d9cc9f43ffa0f38f67d945d38f",
  "0215c5d293fb4c89b42130da184ded5b",
  "bc75573c848f42218ee27d37e623a4e6",
  "701d93d2d1834f2589a987aaf701720d",
  "f2bf0415eb4f4185b37673d3c876423c",
  "310728040e89413aa1c5b04ebb8bb9d3",
])

// Split on blank lines first (structured scripts from AI use blank lines between scenes),
// fall back to sentence-boundary splitting.
function splitScriptForBRoll(script: string): string[] {
  const byBlankLine = script
    .split(/\n\n+/)
    .map(s => s.replace(/\n/g, " ").trim())
    .filter(s => s.length > 10)
  if (byBlankLine.length >= 2 && byBlankLine.length <= 5) return byBlankLine.slice(0, 4)

  const sentences = script.split(/(?<=[.!?¡])\s+/).filter(s => s.trim().length > 0)
  if (sentences.length <= 2) return [script]
  const sceneCount = Math.min(4, Math.max(2, Math.ceil(sentences.length / 2)))
  const perScene = Math.ceil(sentences.length / sceneCount)
  const scenes: string[] = []
  for (let i = 0; i < sceneCount; i++) {
    const chunk = sentences.slice(i * perScene, (i + 1) * perScene).join(" ").trim()
    if (chunk) scenes.push(chunk)
  }
  return scenes.length > 1 ? scenes : [script]
}

// Match scene text keywords → contextually relevant real estate background
function pickSceneBackground(sceneText: string, index: number): Record<string, string> {
  const t = sceneText.toLowerCase()
  if (/piscina|pool|jardín|jardin|garden/.test(t))                            return STYLE_CONFIG.handmade.background
  if (/familia|family|niños|ninos|children|hogar|doral|kendall/.test(t))      return STYLE_CONFIG.warm.background
  if (/playa|beach|mar\b|ocean|waterfront|biscayne/.test(t))                  return STYLE_CONFIG.pop_culture.background
  if (/noche|night|highrise|rascacielos|brickell|downtown/.test(t))           return STYLE_CONFIG.thriller.background
  if (/penthouse|loft|interior|sala|cocina|kitchen/.test(t))                  return STYLE_CONFIG.iconic.background
  if (/moderno|modern|minimalista|contemporáneo/.test(t))                     return STYLE_CONFIG.retro_tech.background
  if (/blanca|white|elegante|lujo|luxury|millón|millon/.test(t))              return STYLE_CONFIG.modern.background
  if (/inversi|invest|dólares|dolares|capital|ingreso|renta|retorno/.test(t)) return STYLE_CONFIG.cinematic.background
  if (/vendedor|seller|vender|precio|staging|fachada/.test(t))               return STYLE_CONFIG.print.background
  return { type: "image", url: BROLL_IMAGE_POOL[index % BROLL_IMAGE_POOL.length] }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.HEYGEN_API_KEY) {
    return NextResponse.json({ error: "HEYGEN_API_KEY not configured" }, { status: 500 })
  }

  try {
    const { avatarId, voiceId, script, ratio = "9:16", styleId, broll = true } = await req.json()
    if (!avatarId || !voiceId || !script?.trim()) {
      return NextResponse.json({ error: "avatarId, voiceId, and script are required" }, { status: 400 })
    }

    const dimension = DIMENSIONS[ratio] ?? DIMENSIONS["9:16"]
    const stylePreset = styleId ? (STYLE_CONFIG[styleId] ?? null) : null
    const isTalkingPhoto = TALKING_PHOTO_IDS.has(avatarId)

    // talking_photo_style "circle" renders Catherine as a portrait circle OVER the background.
    // Without it, talking_photo fills the entire frame and completely hides the background.
    const hasBackground = broll || !!stylePreset?.background

    const character: Record<string, unknown> = isTalkingPhoto
      ? {
          type: "talking_photo",
          talking_photo_id: avatarId,
          ...(hasBackground ? { talking_photo_style: "circle" } : {}),
        }
      : { type: "avatar", avatar_id: avatarId, avatar_style: "normal" }

    let videoInputs: Record<string, unknown>[]

    if (broll) {
      const scenes = splitScriptForBRoll(script)
      videoInputs = scenes.map((sceneText, i) => ({
        character,
        voice: { type: "text", input_text: sceneText, voice_id: voiceId },
        background: pickSceneBackground(sceneText, i),
      }))
    } else {
      const videoInput: Record<string, unknown> = {
        character,
        voice: { type: "text", input_text: script, voice_id: voiceId },
      }
      if (stylePreset?.background) videoInput.background = stylePreset.background
      videoInputs = [videoInput]
    }

    const payload: Record<string, unknown> = {
      video_inputs: videoInputs,
      dimension,
      // Auto-captions rendered on every scene
      caption: true,
    }

    console.log(`[heygen/generate] ${broll ? `B-Roll ${videoInputs.length} scenes` : "single scene"}, ratio=${ratio}, avatar=${avatarId.slice(0, 8)}, circle=${hasBackground && isTalkingPhoto}`)

    const res = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: {
        "X-Api-Key": process.env.HEYGEN_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.message || "HeyGen API error")
    return NextResponse.json({ videoId: data.data?.video_id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
