export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

// The 3 Catherine Gomez personal avatars to use — all are talking_photos.
const CATHERINE_IDS = new Set([
  "701d93d2d1834f2589a987aaf701720d", // Catherine Face Swap Avatar
  "f2bf0415eb4f4185b37673d3c876423c", // Catherine Gomez Avatar
  "2238f900a2284f5c813fc1460fabb299", // Catherine
])

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

  const rawAvatars: any[] = data?.data?.avatars || []
  const rawTalkingPhotos: any[] = data?.data?.talking_photos || []

  // Normalize talking_photo field names
  const talkingPhotos: any[] = rawTalkingPhotos
    .map((tp: any) => ({
      avatar_id: tp.talking_photo_id || tp.id || tp.avatar_id,
      avatar_name: tp.talking_photo_name || tp.name || tp.avatar_name || "Photo Avatar",
      preview_image_url: tp.preview_image_url || tp.preview_url || tp.thumbnail_url || null,
      is_talking_photo: true,
    }))
    .filter((tp: any) => tp.avatar_id)

  // Catherine's 3 confirmed avatars — shown first, labeled as her group
  const catherineAvatars = talkingPhotos
    .filter((tp: any) => CATHERINE_IDS.has(tp.avatar_id))
    .map((tp: any) => ({ ...tp, group: "Catherine Gomez" }))

  // Sort in preferred order: Swap Avatar, Gomez Avatar, Catherine
  const order = [
    "701d93d2d1834f2589a987aaf701720d",
    "f2bf0415eb4f4185b37673d3c876423c",
    "2238f900a2284f5c813fc1460fabb299",
  ]
  catherineAvatars.sort(
    (a: any, b: any) => order.indexOf(a.avatar_id) - order.indexOf(b.avatar_id)
  )

  // Stock avatars: all v2 avatars (no talking_photos — those aren't stock)
  const stockAvatars = rawAvatars.map((a: any) => ({ ...a, group: "Stock Avatars" }))

  console.log(
    `[HeyGen] Catherine avatars found: ${catherineAvatars.length} / 3 expected`
  )

  return NextResponse.json({
    data: { avatars: [...catherineAvatars, ...stockAvatars] },
    catherine_count: catherineAvatars.length,
  })
}
