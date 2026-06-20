export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import Anthropic from "@anthropic-ai/sdk"
import { fetchListingSceneVideo } from "@/lib/pexels-listing"
import type { RemotionScene } from "@/remotion/compositions/ListingVideo"

const FPS = 30

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { script = "" } = await req.json()

    if (!script.trim()) {
      return NextResponse.json({ error: "script is required" }, { status: 400 })
    }

    // Ask Claude to break the script into scenes with captions and Pexels queries
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const claudeRes = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system: `You are a social media video editor. Break a real estate script into 4-6 short scenes for a vertical Reels/TikTok video.

Rules:
- Each scene: 3-6 seconds of spoken text (roughly 7-15 words)
- Keep the original language (Spanish if Spanish, English if English)
- caption: 1-4 words, ALL CAPS, social-media style
- pexels_query: specific Pexels search for real estate B-roll for this part of the script
- caption_style: "kinetic" for hook/opening, "lower-third" for middle scenes, "headline" for CTA

Output ONLY valid JSON:
{
  "scenes": [
    {
      "name": "Hook",
      "script": "the spoken text for this scene",
      "caption": "JUST LISTED",
      "pexels_query": "luxury miami real estate aerial",
      "duration_seconds": 4,
      "caption_style": "kinetic"
    }
  ]
}`,
      messages: [{
        role: "user",
        content: `Break this script into scenes:\n\n${script}\n\nOutput only JSON.`,
      }],
    })

    const planText = claudeRes.content[0].type === "text" ? claudeRes.content[0].text : ""
    const jsonMatch = planText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("Claude did not return valid JSON")

    const plan = JSON.parse(jsonMatch[0])
    const aiScenes: Array<{
      name: string
      script: string
      caption: string
      pexels_query: string
      duration_seconds: number
      caption_style: string
    }> = plan.scenes

    if (!aiScenes?.length) throw new Error("No scenes returned")

    // Fetch Pexels B-roll for each scene in parallel
    const pexelsUrls = await Promise.all(
      aiScenes.map(async (scene) => {
        const apiKey = process.env.PEXELS_API_KEY
        if (!apiKey) return null
        try {
          const res = await fetch(
            `https://api.pexels.com/videos/search?query=${encodeURIComponent(scene.pexels_query)}&per_page=5&orientation=portrait&size=medium`,
            { headers: { Authorization: apiKey }, signal: AbortSignal.timeout(5000) }
          )
          if (!res.ok) return null
          const data = await res.json()
          const videos: any[] = data?.videos ?? []
          if (!videos.length) return null
          const video = videos[Math.floor(Math.random() * Math.min(videos.length, 3))]
          const files: any[] = (video.video_files ?? []).filter((f: any) => f.file_type === "video/mp4")
          const sorted = files.sort((a: any, b: any) => Math.abs(a.width - 720) - Math.abs(b.width - 720))
          return sorted[0]?.link ?? null
        } catch {
          return null
        }
      })
    )

    const scenes: RemotionScene[] = aiScenes.map((scene, i) => ({
      name: scene.name,
      scene_type: "broll",
      script: scene.script,
      caption: scene.caption,
      duration_seconds: scene.duration_seconds ?? 4,
      asset_url: pexelsUrls[i] ?? "",
      asset_type: pexelsUrls[i] ? "video" : "image",
      avatar_present: false,
      caption_style: (scene.caption_style ?? "lower-third") as any,
      caption_position: i === 0 ? "middle" : "bottom",
      ken_burns: "zoom-in",
    }))

    const totalFrames = scenes.reduce((sum, s) => sum + Math.round(s.duration_seconds * FPS), 0)

    const config = {
      scenes,
      agentName: "Catherine Gomez",
      agentTitle: "Real Estate Agent",
      agentPhone: "",
      propertyAddress: "",
      price: "",
      brandColor: "#FF4D1C",
      meta: {
        fps: FPS,
        width: 720,
        height: 1280,
        totalFrames,
        totalSeconds: Math.round(totalFrames / FPS * 10) / 10,
        sceneCount: scenes.length,
        generatedAt: new Date().toISOString(),
      },
    }

    return NextResponse.json(config)
  } catch (e: any) {
    console.error("[remotion/video-ad] Error:", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
