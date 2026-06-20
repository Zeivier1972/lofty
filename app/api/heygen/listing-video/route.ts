export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import Anthropic from "@anthropic-ai/sdk"
import { fetchVideoByQuery, getFallbackBackground } from "@/lib/pexels-video"

const LISTING_VIDEO_SYSTEM = `You are an elite real estate video producer creating videos for HeyGen.

Your job is to convert property information into a 60-90 second high-converting listing video.

Rules:
* Avatar appears ONLY for Scene 1 (Hook) and Scene 7 (CTA). All other scenes are B-roll with voice narration.
* Property footage must occupy at least 70% of screen time.
* Focus on lifestyle benefits, not features.
* Write scripts in Spanish (Catherine's audience is Hispanic Miami buyers).
* Keep each scene script under 40 words — it must fit in the allotted seconds when spoken.
* Captions use short punchy social media style (max 8 words each).

Scene Structure (output ALL 7):
Scene 1: Hook (0-5s) - avatar_present: true
Scene 2: Property Reveal (5-15s) - avatar_present: false
Scene 3: Lifestyle Story (15-35s) - avatar_present: false
Scene 4: Features Montage (35-55s) - avatar_present: false
Scene 5: Neighborhood Benefits (55-70s) - avatar_present: false
Scene 6: Urgency/Price (70-85s) - avatar_present: false
Scene 7: CTA (85-90s) - avatar_present: true

Output ONLY valid JSON — no markdown, no explanation:
{
  "scenes": [
    {
      "scene_number": 1,
      "name": "Hook",
      "script": "spoken text for this scene",
      "broll_query": "pexels video search query for this scene (ignored for avatar scenes)",
      "caption": "short caption (max 8 words)",
      "headline": "on-screen bold text",
      "avatar_present": true
    }
  ]
}`

const DIMENSIONS: Record<string, { width: number; height: number }> = {
  "9:16": { width: 720, height: 1280 },
  "16:9": { width: 1280, height: 720 },
  "1:1":  { width: 720, height: 720 },
}

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
    const { property, avatarId, voiceId, ratio = "9:16" } = await req.json()
    if (!avatarId || !voiceId || !property?.trim()) {
      return NextResponse.json({ error: "property, avatarId, and voiceId are required" }, { status: 400 })
    }

    const dimension = DIMENSIONS[ratio] ?? DIMENSIONS["9:16"]
    const isTalkingPhoto = TALKING_PHOTO_IDS.has(avatarId)
    const orientation = ratio === "9:16" ? "portrait" : "landscape"

    // Step 1: Generate 7-scene video plan via Claude
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const claudeRes = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      system: LISTING_VIDEO_SYSTEM,
      messages: [{ role: "user", content: `Property details:\n\n${property}\n\nOutput only valid JSON.` }],
    })

    const planText = claudeRes.content[0].type === "text" ? claudeRes.content[0].text : ""
    const jsonMatch = planText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("No se pudo generar el plan de video — Claude no devolvió JSON válido")

    const plan = JSON.parse(jsonMatch[0])
    const scenes: Array<{
      scene_number: number
      name: string
      script: string
      broll_query: string
      caption: string
      headline: string
      avatar_present: boolean
    }> = plan.scenes

    if (!scenes?.length) throw new Error("El plan de video no tiene escenas")

    // Step 2: Fetch B-roll for non-avatar scenes in parallel
    const videoUrls = await Promise.all(
      scenes.map(scene =>
        scene.avatar_present
          ? Promise.resolve(null)
          : fetchVideoByQuery(scene.broll_query, orientation)
      )
    )

    // Step 3: Build HeyGen video_inputs
    const character: Record<string, unknown> = isTalkingPhoto
      ? { type: "talking_photo", talking_photo_id: avatarId }
      : { type: "avatar", avatar_id: avatarId, avatar_style: "normal" }

    const video_inputs = scenes.map((scene, i) => {
      const voice = { type: "text", input_text: scene.script, voice_id: voiceId }

      if (scene.avatar_present) {
        return {
          character,
          voice,
          background: getFallbackBackground(scene.script, i),
        }
      }

      const videoUrl = videoUrls[i]
      const background = videoUrl
        ? { type: "video", url: videoUrl, play_style: "fit_to_scene" }
        : getFallbackBackground(scene.broll_query, i)

      return { voice, background }
    })

    const payload = {
      video_inputs,
      dimension,
      caption: true,
    }

    const avatarScenes = scenes.filter(s => s.avatar_present).length
    const pexelsHits = videoUrls.filter(Boolean).length
    console.log(`[listing-video] ${scenes.length} scenes, ${avatarScenes} avatar, ${pexelsHits} Pexels videos`)

    // Step 4: Submit to HeyGen
    const heygenRes = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: {
        "X-Api-Key": process.env.HEYGEN_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const data = await heygenRes.json()
    if (!heygenRes.ok) {
      console.error(`[listing-video] HeyGen error HTTP ${heygenRes.status}:`, JSON.stringify(data))
      const raw = data?.error?.message ?? data?.message ?? data?.error ?? data
      const msg = typeof raw === "string" ? raw : JSON.stringify(raw).slice(0, 400)
      throw new Error(msg)
    }

    return NextResponse.json({ videoId: data.data?.video_id, plan })
  } catch (e: any) {
    console.error("[listing-video] Error:", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
