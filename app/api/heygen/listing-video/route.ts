export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import Anthropic from "@anthropic-ai/sdk"
import { fetchListingSceneVideo, getListingBackground } from "@/lib/pexels-listing"
import { getFallbackBackground } from "@/lib/pexels-video"

// ─── Timeline definition ──────────────────────────────────────────────────────
// 10 scenes that give a fast-cut montage feel within HeyGen's constraints.
// Duration is controlled by word count: HeyGen TTS ≈ 2.3 words/sec.
// Avatar scenes (hook, transition, cta) = 30% of runtime max.
// B-roll scenes = 70% minimum.

const TIMELINE: Array<{
  name: string
  scene_type: string
  avatar_present: boolean
  target_words: number   // target spoken words for this scene
  caption_hint: string   // 4-word all-caps caption style
}> = [
  { name: "Hook",           scene_type: "hook",           avatar_present: true,  target_words: 10, caption_hint: "JUST LISTED" },
  { name: "Exterior",       scene_type: "exterior",       avatar_present: false, target_words: 16, caption_hint: "STUNNING EXTERIOR" },
  { name: "Living Room",    scene_type: "living_room",    avatar_present: false, target_words: 13, caption_hint: "OPEN CONCEPT LIVING" },
  { name: "Kitchen",        scene_type: "kitchen",        avatar_present: false, target_words: 10, caption_hint: "CHEF'S KITCHEN" },
  { name: "Transition",     scene_type: "transition",     avatar_present: true,  target_words: 13, caption_hint: "DESIGNED TO IMPRESS" },
  { name: "Bedroom",        scene_type: "master_bedroom", avatar_present: false, target_words: 8,  caption_hint: "PRIMARY SUITE" },
  { name: "Bathroom",       scene_type: "bathroom",       avatar_present: false, target_words: 8,  caption_hint: "SPA BATHROOM" },
  { name: "Outdoor",        scene_type: "backyard",       avatar_present: false, target_words: 8,  caption_hint: "PRIVATE BACKYARD" },
  { name: "Neighborhood",   scene_type: "neighborhood",   avatar_present: false, target_words: 20, caption_hint: "PRIME LOCATION" },
  { name: "CTA",            scene_type: "cta",            avatar_present: true,  target_words: 30, caption_hint: "CONTACT US TODAY" },
]

// ─── Claude system prompt ─────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  const sceneDescriptions = TIMELINE.map((s, i) =>
    `Scene ${i + 1} — ${s.name} (${s.avatar_present ? "AVATAR" : "B-ROLL"}, target ${s.target_words} words, caption style: "${s.caption_hint}")`
  ).join("\n")

  return `You are an elite real estate video scriptwriter. Generate a 10-scene video script for a Miami property listing.

RULES:
- Write ALL scripts in Spanish (audience = Hispanic Miami buyers)
- AVATAR scenes: Catherine speaks directly to camera. Energetic, personal, direct.
- B-ROLL scenes: punchy narration over footage. Short, visual phrases. Each phrase ≈ 4-6 words.
- Hit target word counts as closely as possible — they control video timing.
- Focus on LIFESTYLE BENEFITS, not feature lists.
- Caption text: 1-4 words, ALL CAPS, social-media style (max 4 words).
- broll_query: specific Pexels search query for this scene's footage.

SCENE STRUCTURE (output ALL 10 in this exact order):
${sceneDescriptions}

Output ONLY valid JSON — no markdown, no explanation:
{
  "scenes": [
    {
      "scene_number": 1,
      "name": "Hook",
      "scene_type": "hook",
      "script": "spoken script for this scene",
      "caption": "JUST LISTED",
      "broll_query": "pexels search query (used only for B-roll scenes)",
      "avatar_present": true
    }
  ]
}`
}

// ─── API config ───────────────────────────────────────────────────────────────

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

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.HEYGEN_API_KEY) {
    return NextResponse.json({ error: "HEYGEN_API_KEY not configured" }, { status: 500 })
  }

  try {
    const {
      property,
      photoUrls = [],  // string[] — listing photos in priority order
      avatarId,
      voiceId,
      ratio = "9:16",
    } = await req.json()

    if (!avatarId || !voiceId || !property?.trim()) {
      return NextResponse.json({ error: "property, avatarId, and voiceId are required" }, { status: 400 })
    }

    const dimension = DIMENSIONS[ratio] ?? DIMENSIONS["9:16"]
    const isTalkingPhoto = TALKING_PHOTO_IDS.has(avatarId)
    const orientation = ratio === "9:16" ? "portrait" : "landscape"

    // Step 1: Generate 10-scene script via Claude
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const claudeRes = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3500,
      system: buildSystemPrompt(),
      messages: [{
        role: "user",
        content: `Property details:\n\n${property}\n\nPhotos available: ${photoUrls.length} listing photos provided.\n\nOutput only valid JSON.`,
      }],
    })

    const planText = claudeRes.content[0].type === "text" ? claudeRes.content[0].text : ""
    const jsonMatch = planText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("Claude no devolvió JSON válido para el plan de video")

    const plan = JSON.parse(jsonMatch[0])
    const scenes: Array<{
      scene_number: number
      name: string
      scene_type: string
      script: string
      caption: string
      broll_query: string
      avatar_present: boolean
    }> = plan.scenes

    if (!scenes?.length) throw new Error("El plan no tiene escenas")

    // Step 2: Fetch Pexels B-roll for non-avatar scenes in parallel
    // Use the Claude-generated broll_query when scene_type is generic; otherwise use our curated queries
    const pexelsUrls = await Promise.all(
      scenes.map((scene) => {
        if (scene.avatar_present) return Promise.resolve(null)
        return fetchListingSceneVideo(scene.scene_type, orientation)
      })
    )

    // Step 3: Build HeyGen video_inputs using the timeline
    const character: Record<string, unknown> = isTalkingPhoto
      ? { type: "talking_photo", talking_photo_id: avatarId }
      : { type: "avatar", avatar_id: avatarId, avatar_style: "normal" }

    const video_inputs = scenes.map((scene, i) => {
      const voice = { type: "text", input_text: scene.script, voice_id: voiceId }

      if (scene.avatar_present) {
        // Avatar scenes: use a quality real estate image behind Catherine
        // (talking_photo fills the frame, but the background is visible briefly during transitions)
        return {
          character,
          voice,
          background: getFallbackBackground(scene.scene_type, i),
        }
      }

      // B-roll scenes: listing photo → Pexels video → static fallback
      const background = getListingBackground(scene.scene_type, photoUrls, pexelsUrls[i], i)
      return { voice, background }
    })

    const avatarScenes  = scenes.filter(s => s.avatar_present).length
    const brollScenes   = scenes.length - avatarScenes
    const pexelsHits    = pexelsUrls.filter(Boolean).length
    const photoHits     = scenes.filter((s, i) => !s.avatar_present && pexelsUrls[i] === null && photoUrls.length > 0).length

    console.log(
      `[listing-video] ${scenes.length} scenes | avatar: ${avatarScenes} | broll: ${brollScenes}` +
      ` | pexels: ${pexelsHits} | listing photos: ${photoUrls.length} provided`
    )

    const payload = {
      video_inputs,
      dimension,
      caption: true,
    }

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

    return NextResponse.json({
      videoId: data.data?.video_id,
      plan: { scenes, meta: { avatarScenes, brollScenes, pexelsHits, photoUrls: photoUrls.length } },
    })
  } catch (e: any) {
    console.error("[listing-video] Error:", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
