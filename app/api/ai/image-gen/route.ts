export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import OpenAI from "openai"
import { v2 as cloudinary } from "cloudinary"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const STYLE_PRESETS: Record<string, string> = {
  luxury: "luxury real estate photography style, high-end, golden hour lighting, elegant, aspirational",
  modern: "modern architectural photography, clean lines, bright natural light, contemporary design",
  warm: "warm and inviting residential photography, family-friendly, cozy atmosphere, lifestyle",
  professional: "professional real estate marketing photo, clean, well-lit, crisp details",
  social: "vibrant social media graphic for real estate, eye-catching, bold colors, Miami lifestyle",
  aerial: "aerial drone photography style, bird's eye view, Miami skyline, waterfront, stunning vista",
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { prompt, style, size } = await req.json()
  if (!prompt?.trim()) return NextResponse.json({ error: "Prompt required" }, { status: 400 })

  const styleGuide = STYLE_PRESETS[style] || STYLE_PRESETS.professional
  const fullPrompt = `${prompt}. Style: ${styleGuide}. Miami, Florida real estate. No text or watermarks in the image.`
  // DALL-E 2 supports only 1024x1024, 512x512, 256x256
  const imageSize = "1024x1024"

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" })
    const response = await client.images.generate({
      model: "dall-e-2",
      prompt: fullPrompt,
      n: 1,
      size: imageSize,
    })

    const openaiUrl = (response.data as any[])?.[0]?.url
    if (!openaiUrl) throw new Error("No image returned from DALL-E")

    // Save to Cloudinary so URL is permanent (OpenAI URLs expire in 1 hour)
    const uploaded = await cloudinary.uploader.upload(openaiUrl, {
      folder: "lofty-crm/generated",
      resource_type: "image",
    })

    return NextResponse.json({ url: uploaded.secure_url, prompt: fullPrompt })
  } catch (e: any) {
    console.error("[AI image-gen]", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
