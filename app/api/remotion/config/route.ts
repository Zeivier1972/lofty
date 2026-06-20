export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import Anthropic from "@anthropic-ai/sdk"
import { fetchListingSceneVideo } from "@/lib/pexels-listing"
import type { RemotionScene } from "@/remotion/compositions/ListingVideo"

const FPS = 30

const TIMELINE = [
  { name: "Hook",         scene_type: "hook",           avatar: false, words: 10,  duration: 4,  caption_style: "headline",    caption_position: "middle", ken_burns: "zoom-in"       },
  { name: "Exterior",     scene_type: "exterior",       avatar: false, words: 16,  duration: 5,  caption_style: "lower-third", caption_position: "bottom", ken_burns: "pan-right"     },
  { name: "Living Room",  scene_type: "living_room",    avatar: false, words: 13,  duration: 5,  caption_style: "lower-third", caption_position: "bottom", ken_burns: "zoom-in-right" },
  { name: "Kitchen",      scene_type: "kitchen",        avatar: false, words: 10,  duration: 4,  caption_style: "badge",       caption_position: "bottom", ken_burns: "zoom-in"       },
  { name: "Transition",   scene_type: "transition",     avatar: true,  words: 13,  duration: 5,  caption_style: "headline",    caption_position: "top",    ken_burns: "zoom-out"      },
  { name: "Bedroom",      scene_type: "master_bedroom", avatar: false, words: 8,   duration: 3,  caption_style: "badge",       caption_position: "bottom", ken_burns: "pan-left"      },
  { name: "Bathroom",     scene_type: "bathroom",       avatar: false, words: 8,   duration: 3,  caption_style: "badge",       caption_position: "bottom", ken_burns: "pan-right"     },
  { name: "Outdoor",      scene_type: "backyard",       avatar: false, words: 8,   duration: 3,  caption_style: "lower-third", caption_position: "bottom", ken_burns: "zoom-out"      },
  { name: "Neighborhood", scene_type: "neighborhood",   avatar: false, words: 20,  duration: 6,  caption_style: "lower-third", caption_position: "bottom", ken_burns: "pan-up"        },
  { name: "CTA",          scene_type: "cta",            avatar: true,  words: 30,  duration: 8,  caption_style: "kinetic",     caption_position: "top",    ken_burns: "zoom-in"       },
] as const

const PHOTO_INDEX: Record<string, number> = {
  exterior: 0, living_room: 1, kitchen: 2, master_bedroom: 3,
  bathroom: 4, backyard: 5, pool: 6, aerial: 7,
}

function buildPrompt(): string {
  return `You are an elite real estate video scriptwriter for Catherine Gomez, Miami luxury realtor.

Generate scripts for a 10-scene social media video targeting Hispanic Miami buyers.

RULES:
- Write ALL scripts in Spanish
- Avatar scenes: Catherine speaks directly, energetic, personal
- B-roll scenes: punchy, visual, 4-6 words per phrase
- Caption: 1-4 words, ALL CAPS
- Hit target word counts

Output ONLY valid JSON (no markdown):
{
  "scenes": [
    { "scene_number": 1, "name": "Hook", "script": "...", "caption": "JUST LISTED" },
    ...10 scenes total...
  ]
}`
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const {
      property = "",
      photoUrls = [] as string[],
      agentName = "Catherine Gomez",
      agentTitle = "Real Estate Agent",
      agentPhone = "(305) 555-0100",
      propertyAddress = "",
      price = "",
      brandColor = "#FF4D1C",
    } = await req.json()

    if (!property?.trim()) {
      return NextResponse.json({ error: "property description is required" }, { status: 400 })
    }

    // Step 1: Generate scripts via Claude
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const sceneList = TIMELINE.map((t, i) =>
      `Scene ${i + 1} — ${t.name} (${t.avatar ? "AVATAR" : "B-ROLL"}, ~${t.words} words, caption: "${t.name.toUpperCase()}")`
    ).join("\n")

    const claudeRes = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      system: buildPrompt(),
      messages: [{
        role: "user",
        content: `Property: ${property}\n\nScenes:\n${sceneList}\n\nOutput only JSON.`,
      }],
    })

    const planText = claudeRes.content[0].type === "text" ? claudeRes.content[0].text : ""
    const jsonMatch = planText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("Claude did not return valid JSON")

    const plan = JSON.parse(jsonMatch[0])
    const aiScenes: Array<{ scene_number: number; name: string; script: string; caption: string }> = plan.scenes

    // Step 2: Fetch Pexels B-roll for non-avatar scenes
    const pexelsUrls = await Promise.all(
      TIMELINE.map((t) => {
        if (t.avatar) return Promise.resolve(null)
        return fetchListingSceneVideo(t.scene_type, "portrait")
      })
    )

    // Step 3: Build RemotionScene array
    const scenes: RemotionScene[] = TIMELINE.map((t, i) => {
      const ai = aiScenes[i] ?? { script: "", caption: t.name.toUpperCase() }

      // Asset selection: listing photo > Pexels video > empty (avatar/dark bg)
      const photoIdx = PHOTO_INDEX[t.scene_type]
      const listingPhoto = photoIdx !== undefined ? (photoUrls[photoIdx] ?? null) : null
      const pexelsVideo = pexelsUrls[i]

      let assetUrl = ""
      let assetType: "image" | "video" = "image"

      if (t.avatar) {
        // Avatar scenes: use Pexels as dim background or empty
        assetUrl = pexelsVideo ?? ""
        assetType = pexelsVideo ? "video" : "image"
      } else if (listingPhoto) {
        assetUrl = listingPhoto
        assetType = "image"
      } else if (pexelsVideo) {
        assetUrl = pexelsVideo
        assetType = "video"
      }

      return {
        name: t.name,
        scene_type: t.scene_type,
        script: ai.script,
        caption: ai.caption || t.name.toUpperCase(),
        duration_seconds: t.duration,
        asset_url: assetUrl,
        asset_type: assetType,
        avatar_present: t.avatar,
        ken_burns: t.ken_burns as any,
        caption_style: t.caption_style as any,
        caption_position: t.caption_position as any,
      }
    })

    const totalFrames = scenes.reduce((sum, s) => sum + Math.round(s.duration_seconds * FPS), 0)
    const totalSeconds = totalFrames / FPS

    const config = {
      scenes,
      agentName,
      agentTitle,
      agentPhone,
      propertyAddress,
      price,
      brandColor,
      meta: {
        fps: FPS,
        width: 720,
        height: 1280,
        totalFrames,
        totalSeconds: Math.round(totalSeconds * 10) / 10,
        sceneCount: scenes.length,
        photoCount: photoUrls.length,
        generatedAt: new Date().toISOString(),
      },
    }

    return NextResponse.json(config)
  } catch (e: any) {
    console.error("[remotion/config] Error:", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
