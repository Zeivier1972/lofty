export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { fetchSceneVideoUrl, getFallbackBackground } from "@/lib/pexels-video"

const DIMENSIONS: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1280, height: 720 },
  "9:16": { width: 720, height: 1280 },
  "1:1":  { width: 720, height: 720 },
}

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

// Split script into scenes: scene 0 = avatar intro (short hook), scenes 1+ = b-roll segments.
// Blank-line separated paragraphs are respected first; falls back to sentence splitting.
function splitScriptForBRoll(script: string): string[] {
  const byBlankLine = script
    .split(/\n\n+/)
    .map(s => s.replace(/\n/g, " ").trim())
    .filter(s => s.length > 10)
  if (byBlankLine.length >= 2 && byBlankLine.length <= 5) {
    return byBlankLine.slice(0, 4)
  }

  const sentences = script.split(/(?<=[.!?¡])\s+/).filter(s => s.trim().length > 0)
  if (sentences.length <= 2) return [script]

  // Scene 0 (avatar): first 1-2 sentences as the hook
  const hookEnd = Math.min(2, Math.ceil(sentences.length * 0.3))
  const hook = sentences.slice(0, hookEnd).join(" ").trim()
  const rest = sentences.slice(hookEnd)

  // Remaining sentences: 2-3 b-roll segments
  const brollCount = Math.min(3, Math.max(1, Math.ceil(rest.length / 2)))
  const perScene = Math.ceil(rest.length / brollCount)
  const brolls: string[] = []
  for (let i = 0; i < brollCount; i++) {
    const chunk = rest.slice(i * perScene, (i + 1) * perScene).join(" ").trim()
    if (chunk) brolls.push(chunk)
  }

  return [hook, ...brolls]
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
    const isTalkingPhoto = TALKING_PHOTO_IDS.has(avatarId)
    const orientation = ratio === "9:16" ? "portrait" : "landscape"

    let videoInputs: Record<string, unknown>[]

    if (broll) {
      const scenes = splitScriptForBRoll(script)

      // Fetch B-roll video clips for middle scenes only (first + last are avatar)
      const videoUrls = await Promise.all(
        scenes.map((sceneText, i) =>
          i === 0 || i === scenes.length - 1
            ? Promise.resolve(null)
            : fetchSceneVideoUrl(sceneText, orientation)
        )
      )

      const character: Record<string, unknown> = isTalkingPhoto
        ? { type: "talking_photo", talking_photo_id: avatarId }
        : { type: "avatar", avatar_id: avatarId, avatar_style: "normal" }

      videoInputs = scenes.map((sceneText, i) => {
        const isFirst = i === 0
        const isLast = i === scenes.length - 1

        if (isFirst || isLast) {
          // Avatar scenes: intro hook + outro CTA — Catherine on screen
          return {
            character,
            voice: { type: "text", input_text: sceneText, voice_id: voiceId },
            background: getFallbackBackground(sceneText, i),
          }
        }

        // Middle scenes: B-roll — Pexels video clip (or image fallback)
        const videoUrl = videoUrls[i]
        return {
          voice: { type: "text", input_text: sceneText, voice_id: voiceId },
          background: videoUrl
            ? { type: "video", url: videoUrl, play_style: "fit_to_scene" }
            : getFallbackBackground(sceneText, i),
        }
      })

      const brollCount = Math.max(0, scenes.length - 2)
      console.log(
        `[heygen/generate] Structure: avatar intro + ${brollCount} B-roll + avatar outro (${scenes.length} total), Pexels: ${videoUrls.filter(Boolean).length}/${brollCount}, orientation: ${orientation}`
      )
    } else {
      // Single-scene mode — apply style preset background if selected
      const STYLE_BACKGROUNDS: Record<string, string> = {
        cinematic:  "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1280&q=80",
        thriller:   "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1280&q=80",
        retro_tech: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1280&q=80",
        pop_culture:"https://images.unsplash.com/photo-1533106497176-45ae19e68ba2?w=1280&q=80",
        modern:     "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1280&q=80",
        warm:       "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1280&q=80",
        handmade:   "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1280&q=80",
        iconic:     "https://images.unsplash.com/photo-1613977257365-aaae5a9817ff?w=1280&q=80",
        print:      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1280&q=80",
      }
      const hasBackground = !!styleId && styleId !== "none" && STYLE_BACKGROUNDS[styleId]
      const character: Record<string, unknown> = isTalkingPhoto
        ? { type: "talking_photo", talking_photo_id: avatarId }
        : { type: "avatar", avatar_id: avatarId, avatar_style: "normal" }

      const videoInput: Record<string, unknown> = {
        character,
        voice: { type: "text", input_text: script, voice_id: voiceId },
      }
      if (hasBackground) videoInput.background = { type: "image", url: STYLE_BACKGROUNDS[styleId] }
      videoInputs = [videoInput]
    }

    const payload: Record<string, unknown> = {
      video_inputs: videoInputs,
      dimension,
      caption: true,
    }

    console.log(`[heygen/generate] Sending payload:`, JSON.stringify(payload).slice(0, 2000))

    const res = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: {
        "X-Api-Key": process.env.HEYGEN_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error(`[heygen/generate] HeyGen error HTTP ${res.status}:`, JSON.stringify(data))
      const raw = data?.error?.message ?? data?.message ?? data?.error ?? data
      const msg = typeof raw === "string" ? raw : JSON.stringify(raw).slice(0, 400)
      throw new Error(msg)
    }
    return NextResponse.json({ videoId: data.data?.video_id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
