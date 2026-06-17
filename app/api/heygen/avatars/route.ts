export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

// Known Catherine Gomez avatar IDs (from /api/social/heygen-avatars debug endpoint).
// These are always surfaced first regardless of naming variations.
const CATHERINE_AVATAR_IDS = new Set([
  "0edfa54de240487f8dc6bcfd68924ab6",
  "9ceb355150d84ebd86d11d08cec11a6f",
  "56ccc3395f814ce78925129ebd049430",
  "ddc38cd2a91b4ab5ae0863a79a7239be",
  "05b1aacb453e4f1db169f4cd63d32432",
  "507e27eca7454a00bbbeb740e80d6b01",
])

function isCatherine(a: { avatar_id?: string; avatar_name?: string }): boolean {
  if (a.avatar_id && CATHERINE_AVATAR_IDS.has(a.avatar_id)) return true
  return a.avatar_name?.toLowerCase().includes("catherine") ?? false
}

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

  // Normalize talking_photos field names
  const talkingPhotos: any[] = rawTalkingPhotos
    .map((tp: any) => ({
      avatar_id: tp.talking_photo_id || tp.id || tp.avatar_id,
      avatar_name: tp.talking_photo_name || tp.name || tp.avatar_name || "Photo Avatar",
      preview_image_url: tp.preview_image_url || tp.preview_url || tp.thumbnail_url || null,
      is_custom: true,
    }))
    .filter((tp: any) => tp.avatar_id)

  const allAvatars: any[] = [...rawAvatars, ...talkingPhotos]

  // Tag Catherine's avatars and split into groups
  const catherineAvatars = allAvatars
    .filter(isCatherine)
    .map(a => ({ ...a, is_custom: true, group: "Catherine Gomez" }))

  const otherAvatars = allAvatars
    .filter(a => !isCatherine(a))
    .map(a => ({ ...a, group: "Stock Avatars" }))

  console.log(
    `[HeyGen] avatars: ${rawAvatars.length}, talking_photos: ${talkingPhotos.length}, ` +
    `catherine: ${catherineAvatars.length}`
  )

  // Catherine's avatars come first so the UI can split on the group field
  return NextResponse.json({
    data: { avatars: [...catherineAvatars, ...otherAvatars] },
    catherine_count: catherineAvatars.length,
  })
}
