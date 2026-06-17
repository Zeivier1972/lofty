export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.HEYGEN_API_KEY) {
    return NextResponse.json({ error: "HEYGEN_API_KEY not configured" }, { status: 500 })
  }

  const res = await fetch("https://api.heygen.com/v2/avatars", {
    headers: { "X-Api-Key": process.env.HEYGEN_API_KEY },
  })
  const data = await res.json()

  // Log structure once so we can see field names in Railway logs
  const tpSample = data?.data?.talking_photos?.[0]
  if (tpSample) {
    console.log("[HeyGen] talking_photo sample keys:", Object.keys(tpSample))
    console.log("[HeyGen] talking_photo sample:", JSON.stringify(tpSample).slice(0, 300))
  }

  // Normalize talking_photos — try all known field name variants
  const avatars: any[] = data?.data?.avatars || []
  const talkingPhotos: any[] = (data?.data?.talking_photos || []).map((tp: any) => ({
    avatar_id: tp.talking_photo_id || tp.id || tp.avatar_id,
    avatar_name: tp.talking_photo_name || tp.name || tp.avatar_name || "Photo Avatar",
    preview_image_url: tp.preview_image_url || tp.preview_url || tp.thumbnail_url || null,
  })).filter((tp: any) => tp.avatar_id)

  console.log(`[HeyGen] avatars: ${avatars.length}, talking_photos: ${talkingPhotos.length}`)

  return NextResponse.json({
    data: { avatars: [...avatars, ...talkingPhotos] },
  })
}
