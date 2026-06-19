export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

const DIMENSIONS: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1280, height: 720 },
  "9:16": { width: 720, height: 1280 },
  "1:1":  { width: 720, height: 720 },
}

const STYLE_CONFIG: Record<string, { avatar_style: string; background: Record<string, string> }> = {
  // Real estate themed backgrounds — all use image type for visual richness
  cinematic:  { avatar_style: "normal", background: { type: "image", url: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1280&q=80" } },  // Miami luxury home, golden hour
  thriller:   { avatar_style: "normal", background: { type: "image", url: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1280&q=80" } },  // High-rise luxury building at night
  retro_tech: { avatar_style: "normal", background: { type: "image", url: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1280&q=80" } },  // Modern minimalist architecture
  pop_culture:{ avatar_style: "normal", background: { type: "image", url: "https://images.unsplash.com/photo-1533106497176-45ae19e68ba2?w=1280&q=80" } },  // Miami Beach waterfront
  modern:     { avatar_style: "normal", background: { type: "image", url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1280&q=80" } },  // Clean modern white house
  warm:       { avatar_style: "normal", background: { type: "image", url: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1280&q=80" } },  // Warm suburban family home
  handmade:   { avatar_style: "normal", background: { type: "image", url: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1280&q=80" } },  // Luxury pool home, natural feel
  iconic:     { avatar_style: "normal", background: { type: "image", url: "https://images.unsplash.com/photo-1613977257365-aaae5a9817ff?w=1280&q=80" } },  // Luxury penthouse interior
  print:      { avatar_style: "normal", background: { type: "image", url: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1280&q=80" } },  // Architectural exterior, dramatic
}

// Rotating pool of real estate backgrounds used for B-Roll scenes
const BROLL_IMAGE_POOL = [
  "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1280&q=80",  // Miami luxury home, golden hour
  "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1280&q=80",  // High-rise at night
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1280&q=80",  // Modern minimalist
  "https://images.unsplash.com/photo-1533106497176-45ae19e68ba2?w=1280&q=80",  // Miami Beach waterfront
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1280&q=80",  // Clean modern house
  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1280&q=80",  // Suburban family home
  "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1280&q=80",  // Luxury pool
  "https://images.unsplash.com/photo-1613977257365-aaae5a9817ff?w=1280&q=80",  // Penthouse interior
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1280&q=80",  // Architectural exterior
]

// Catherine Gomez "8 looks" talking_photo IDs — confirmed by user
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

// Split script into 2-4 scenes on sentence boundaries for B-Roll multi-scene video
function splitScriptForBRoll(script: string): string[] {
  const sentences = script.split(/(?<=[.!?¡¿])\s+/).filter(s => s.trim().length > 0)
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

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.HEYGEN_API_KEY) {
    return NextResponse.json({ error: "HEYGEN_API_KEY not configured" }, { status: 500 })
  }

  try {
    const { avatarId, voiceId, script, ratio = "16:9", styleId, broll = false } = await req.json()
    if (!avatarId || !voiceId || !script?.trim()) {
      return NextResponse.json({ error: "avatarId, voiceId, and script are required" }, { status: 400 })
    }

    const dimension = DIMENSIONS[ratio] ?? DIMENSIONS["16:9"]
    const stylePreset = styleId ? (STYLE_CONFIG[styleId] ?? null) : null
    const isTalkingPhoto = TALKING_PHOTO_IDS.has(avatarId)

    const character: Record<string, unknown> = isTalkingPhoto
      ? { type: "talking_photo", talking_photo_id: avatarId }
      : { type: "avatar", avatar_id: avatarId, avatar_style: "normal" }

    let videoInputs: Record<string, unknown>[]

    if (broll) {
      // Multi-scene B-Roll: split script, each scene gets a different real estate background
      const scenes = splitScriptForBRoll(script)
      videoInputs = scenes.map((sceneText, i) => {
        const bgUrl = BROLL_IMAGE_POOL[i % BROLL_IMAGE_POOL.length]
        return {
          character,
          voice: { type: "text", input_text: sceneText, voice_id: voiceId },
          background: { type: "image", url: bgUrl },
        }
      })
    } else {
      // Single scene — apply selected style background if any
      const videoInput: Record<string, unknown> = {
        character,
        voice: { type: "text", input_text: script, voice_id: voiceId },
      }
      if (stylePreset?.background) {
        videoInput.background = stylePreset.background
      }
      videoInputs = [videoInput]
    }

    const payload: Record<string, unknown> = {
      video_inputs: videoInputs,
      dimension,
      caption: true,
    }

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
