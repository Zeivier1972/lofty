export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

// Catherine's confirmed regular avatar IDs (type: "avatar" — NOT talking_photos)
const CATHERINE_IDS = new Set([
  "0edfa54de240487f8dc6bcfd68924ab6",
  "9ceb355150d84ebd86d11d08cec11a6f",
  "56ccc3395f814ce78925129ebd049430",
  "ddc38cd2a91b4ab5ae0863a79a7239be",
  "05b1aacb453e4f1db169f4cd63d32432",
  "507e27eca7454a00bbbeb740e80d6b01",
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

  // Find Catherine in talking_photos first (by ID), then in regular avatars (by ID or name)
  const catherineFromPhotos = talkingPhotos.filter((tp: any) => CATHERINE_IDS.has(tp.avatar_id))
  const catherineFromRegular = rawAvatars
    .filter((a: any) => CATHERINE_IDS.has(a.avatar_id) || a.avatar_name?.toLowerCase().includes("catherine"))
    .map((a: any) => ({ ...a, is_talking_photo: false }))

  const catherineAvatars = [...catherineFromPhotos, ...catherineFromRegular]
    .map((a: any) => ({ ...a, group: "Catherine Gomez" }))

  // All remaining regular avatars — shown so user can find the right one
  const seenIds = new Set(catherineAvatars.map((a: any) => a.avatar_id))
  const stockAvatars = rawAvatars
    .filter((a: any) => !seenIds.has(a.avatar_id))
    .map((a: any) => ({ ...a, group: "Stock Avatars" }))

  console.log(
    `[HeyGen] Catherine avatars found: ${catherineAvatars.length} (${catherineFromPhotos.length} talking_photo, ${catherineFromRegular.length} regular)`
  )

  return NextResponse.json({
    data: { avatars: [...catherineAvatars, ...stockAvatars] },
    catherine_count: catherineAvatars.length,
  })
}
