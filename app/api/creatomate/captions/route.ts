export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

export async function POST(req: Request) {
  if (!process.env.CREATOMATE_API_KEY) {
    return NextResponse.json({ error: "CREATOMATE_API_KEY not configured" }, { status: 500 })
  }

  try {
    const { videoUrl, width = 720, height = 1280 } = await req.json()
    if (!videoUrl) return NextResponse.json({ error: "videoUrl is required" }, { status: 400 })

    // Creatomate inline source with auto-transcript captions.
    // The video element is given an ID so the text element can reference it as transcript_source.
    const source = {
      output_format: "mp4",
      frame_rate: 30,
      width,
      height,
      elements: [
        {
          id: "main-video",
          type: "video",
          source: videoUrl,
          fit: "cover",
          time: 0,
          duration: "auto",
        },
        {
          type: "text",
          transcript: true,
          transcript_source: "main-video",
          transcript_effect: "highlight",
          transcript_placement: "word",
          transcript_highlight_color: "#FFD700",
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

    console.log(`[creatomate/captions] Submitting to v1/renders for: ${videoUrl.slice(0, 80)}`)

    const res = await fetch("https://api.creatomate.com/v1/renders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CREATOMATE_API_KEY}`,
      },
      body: JSON.stringify({ source }),
    })

    const data = await res.json()
    console.log(`[creatomate/captions] API response (HTTP ${res.status}):`, JSON.stringify(data).slice(0, 500))

    if (!res.ok) {
      const raw = data?.message ?? data?.error ?? data
      throw new Error(typeof raw === "string" ? raw : JSON.stringify(raw).slice(0, 300))
    }

    const render = Array.isArray(data) ? data[0] : data
    if (!render?.id) {
      throw new Error(`Unexpected Creatomate response: ${JSON.stringify(data).slice(0, 200)}`)
    }

    console.log(`[creatomate/captions] Render started: ${render.id} (status: ${render.status})`)
    return NextResponse.json({ renderId: render.id, status: render.status, url: render.url ?? null })
  } catch (e: any) {
    console.error("[creatomate/captions] Error:", e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
