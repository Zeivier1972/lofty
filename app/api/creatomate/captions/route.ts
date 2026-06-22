export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

// Submits a completed HeyGen video to Creatomate for kinetic word-by-word caption rendering.
// Uses Creatomate's inline JSON source (no pre-built template needed) with their
// transcript auto-caption feature: it transcribes the audio and animates each word.
export async function POST(req: Request) {
  if (!process.env.CREATOMATE_API_KEY) {
    return NextResponse.json({ error: "CREATOMATE_API_KEY not configured" }, { status: 500 })
  }

  try {
    const { videoUrl, width = 720, height = 1280 } = await req.json()
    if (!videoUrl) return NextResponse.json({ error: "videoUrl is required" }, { status: 400 })

    const source = {
      output_format: "mp4",
      frame_rate: 30,
      width,
      height,
      elements: [
        // Layer 1: the source video (avatar + b-roll)
        {
          type: "video",
          source: videoUrl,
          fit: "cover",
          time: 0,
          duration: "auto",
        },
        // Layer 2: kinetic word-by-word captions auto-transcribed from the video audio
        {
          type: "text",
          transcript: true,
          transcript_source: videoUrl,
          transcript_effect: "highlight",       // each word highlights as it's spoken
          transcript_placement: "word",          // one word at a time
          transcript_highlight_color: "#FFD700", // gold highlight — matches Catherine's brand
          font_family: "Montserrat",
          font_weight: "800",
          font_size: "7.5vh",
          fill_color: "#FFFFFF",
          stroke_color: "#000000",
          stroke_width: "0.04em",
          text_transform: "uppercase",
          x: "50%",
          y: "82%",
          width: "88%",
          height: "auto",
        },
      ],
    }

    console.log(`[creatomate/captions] Submitting kinetic caption render for: ${videoUrl.slice(0, 80)}`)

    const res = await fetch("https://api.creatomate.com/v1/renders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CREATOMATE_API_KEY}`,
      },
      body: JSON.stringify({ source }),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error("[creatomate/captions] API error:", JSON.stringify(data))
      const raw = data?.message ?? data?.error ?? data
      throw new Error(typeof raw === "string" ? raw : JSON.stringify(raw).slice(0, 300))
    }

    const render = Array.isArray(data) ? data[0] : data
    console.log(`[creatomate/captions] Render started: ${render.id}`)

    return NextResponse.json({ renderId: render.id, status: render.status, url: render.url ?? null })
  } catch (e: any) {
    console.error("[creatomate/captions] Error:", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
