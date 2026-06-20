export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

// Template ID is not a secret — it's the public Creatomate template UUID
const DEFAULT_TEMPLATE_ID = "859fa005-55e6-4b69-851a-ef560c0d1d6d"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.CREATOMATE_API_KEY) {
    return NextResponse.json({ error: "CREATOMATE_API_KEY not configured in Railway" }, { status: 500 })
  }

  try {
    const {
      photoUrls = [],           // string[] — listing photos in order: exterior, living, kitchen, bedroom…
      modifications: extra = {}, // any additional element overrides (text, color, etc.)
    } = await req.json()

    if (!photoUrls.length) {
      return NextResponse.json({ error: "At least one photo URL is required" }, { status: 400 })
    }

    // Map photos to template image slots (Image-1, Image-2, …)
    const modifications: Record<string, string> = { ...extra }
    photoUrls.forEach((url: string, i: number) => {
      if (url?.startsWith("http")) {
        modifications[`Image-${i + 1}.source`] = url
      }
    })

    const templateId = process.env.CREATOMATE_LISTING_TEMPLATE_ID ?? DEFAULT_TEMPLATE_ID

    console.log(`[creatomate/render] template: ${templateId}, images: ${Object.keys(modifications).filter(k => k.includes("Image")).length}`)

    const res = await fetch("https://api.creatomate.com/v2/renders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.CREATOMATE_API_KEY}`,
      },
      body: JSON.stringify({
        template_id: templateId,
        modifications,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error("[creatomate/render] API error:", JSON.stringify(data))
      const raw = data?.message ?? data?.error ?? data
      throw new Error(typeof raw === "string" ? raw : JSON.stringify(raw).slice(0, 300))
    }

    // Creatomate returns an array (one entry per output in the template)
    const render = Array.isArray(data) ? data[0] : data

    return NextResponse.json({
      renderId: render.id,
      status: render.status,
      url: render.url ?? null,
    })
  } catch (e: any) {
    console.error("[creatomate/render] Error:", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
