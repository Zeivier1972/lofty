export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

const DIMENSIONS: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1280, height: 720 },
  "9:16": { width: 720, height: 1280 },
  "1:1":  { width: 720, height: 720 },
}

const STYLE_CONFIG: Record<string, { avatar_style: string; background: Record<string, string> }> = {
  cinematic:    { avatar_style: "closeUp", background: { type: "color", value: "#0A0A0A" } },
  thriller:     { avatar_style: "normal",  background: { type: "color", value: "#1A1A2E" } },
  retro_tech:   { avatar_style: "normal",  background: { type: "color", value: "#0D1117" } },
  pop_culture:  { avatar_style: "normal",  background: { type: "color", value: "#FF006E" } },
  modern:       { avatar_style: "normal",  background: { type: "color", value: "#2563EB" } },
  warm:         { avatar_style: "normal",  background: { type: "color", value: "#F97316" } },
  handmade:     { avatar_style: "normal",  background: { type: "color", value: "#FDF6E3" } },
  iconic:       { avatar_style: "closeUp", background: { type: "color", value: "#7C3AED" } },
  print:        { avatar_style: "normal",  background: { type: "color", value: "#1C1917" } },
}

// HeyGen talking_photo IDs require character.type = "talking_photo" + talking_photo_id.
// Regular stock avatar IDs use character.type = "avatar" + avatar_id.
const TALKING_PHOTO_IDS = new Set([
  "701d93d2d1834f2589a987aaf701720d", // Catherine Face Swap Avatar
  "f2bf0415eb4f4185b37673d3c876423c", // Catherine Gomez Avatar
  "2238f900a2284f5c813fc1460fabb299", // Catherine
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

    // HeyGen API differs for talking_photos vs stock avatars
    const character: Record<string, unknown> = isTalkingPhoto
      ? {
          type: "talking_photo",
          talking_photo_id: avatarId,
        }
      : {
          type: "avatar",
          avatar_id: avatarId,
          avatar_style: stylePreset?.avatar_style ?? "normal",
        }

    const videoInput: Record<string, unknown> = {
      character,
      voice: { type: "text", input_text: script, voice_id: voiceId },
    }

    if (!isTalkingPhoto && stylePreset?.background) {
      videoInput.background = stylePreset.background
    }

    const res = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: {
        "X-Api-Key": process.env.HEYGEN_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        video_inputs: [videoInput],
        dimension,
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.message || "HeyGen API error")
    return NextResponse.json({ videoId: data.data?.video_id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
