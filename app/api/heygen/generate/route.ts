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
  cinematic:  { avatar_style: "closeUp", background: { type: "image", url: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1280&q=80" } },  // Miami luxury home, golden hour
  thriller:   { avatar_style: "normal",  background: { type: "image", url: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1280&q=80" } },  // High-rise luxury building at night
  retro_tech: { avatar_style: "normal",  background: { type: "image", url: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1280&q=80" } },  // Modern minimalist architecture
  pop_culture:{ avatar_style: "normal",  background: { type: "image", url: "https://images.unsplash.com/photo-1533106497176-45ae19e68ba2?w=1280&q=80" } },  // Miami Beach waterfront
  modern:     { avatar_style: "normal",  background: { type: "image", url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1280&q=80" } },  // Clean modern white house
  warm:       { avatar_style: "normal",  background: { type: "image", url: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1280&q=80" } },  // Warm suburban family home
  handmade:   { avatar_style: "normal",  background: { type: "image", url: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1280&q=80" } },  // Luxury pool home, natural feel
  iconic:     { avatar_style: "closeUp", background: { type: "image", url: "https://images.unsplash.com/photo-1613977257365-aaae5a9817ff?w=1280&q=80" } },  // Luxury penthouse interior
  print:      { avatar_style: "normal",  background: { type: "image", url: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1280&q=80" } },  // Architectural exterior, dramatic
}

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

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.HEYGEN_API_KEY) {
    return NextResponse.json({ error: "HEYGEN_API_KEY not configured" }, { status: 500 })
  }

  try {
    const { avatarId, voiceId, script, ratio = "16:9", styleId } = await req.json()
    if (!avatarId || !voiceId || !script?.trim()) {
      return NextResponse.json({ error: "avatarId, voiceId, and script are required" }, { status: 400 })
    }

    const dimension = DIMENSIONS[ratio] ?? DIMENSIONS["16:9"]
    const stylePreset = styleId ? (STYLE_CONFIG[styleId] ?? null) : null
    const isTalkingPhoto = TALKING_PHOTO_IDS.has(avatarId)

    const character: Record<string, unknown> = isTalkingPhoto
      ? { type: "talking_photo", talking_photo_id: avatarId }
      : { type: "avatar", avatar_id: avatarId, avatar_style: stylePreset?.avatar_style ?? "normal" }

    const videoInput: Record<string, unknown> = {
      character,
      voice: { type: "text", input_text: script, voice_id: voiceId },
    }

    // Apply background for all avatar types — talking_photo supports backgrounds too
    if (stylePreset?.background) {
      videoInput.background = stylePreset.background
    }

    const res = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: {
        "X-Api-Key": process.env.HEYGEN_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ video_inputs: [videoInput], dimension }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.message || "HeyGen API error")
    return NextResponse.json({ videoId: data.data?.video_id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
