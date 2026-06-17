export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

// ── Confirmed talking_photo IDs for Catherine Gomez ──────────────────────────
// These are photo-realistic avatars created from Catherine's own footage.
// The OLD v2_avatar "Catherine Gomez" IDs (the 6 stock-style ones) are
// intentionally excluded — Catherine does not want to use those.
const CATHERINE_TALKING_PHOTO_IDS = new Set([
  "701d93d2d1834f2589a987aaf701720d", // Catherine Face Swap Avatar
  "f2bf0415eb4f4185b37673d3c876423c", // Catherine Gomez Avatar (parent of 13 looks)
  "a3ec164142604863aa090eee58facf2e", // Catherine Gomez (talking photo)
  "e386382a4367473aa3c98b1af4129ece", // Catherine the Confident Realtor (1)
  "663bfeadebbb4d43aa42336af17855da", // Catherine the Confident Realtor (2)
  "2238f900a2284f5c813fc1460fabb299", // Catherine
])

// Placeholder for the 13 sub-looks of "Catherine Gomez Avatar" — IDs to be
// discovered via /api/social/heygen-avatars?mode=looks and added here.
const CATHERINE_LOOK_IDS = new Set<string>([
  // e.g. "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", // Look 1
])

function isCatherine(a: { avatar_id?: string; avatar_name?: string }): boolean {
  if (!a.avatar_id) return false
  if (CATHERINE_TALKING_PHOTO_IDS.has(a.avatar_id)) return true
  if (CATHERINE_LOOK_IDS.has(a.avatar_id)) return true
  // Fallback: name-based match for any future avatars not yet hard-pinned
  const n = a.avatar_name?.toLowerCase() ?? ""
  return n.includes("catherine") || n.includes("confident realtor") || n.includes("swap avatar")
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
      is_talking_photo: true,
    }))
    .filter((tp: any) => tp.avatar_id)

  // Only talking_photos can be Catherine's personal avatars — skip v2_avatars for her group
  const catherineAvatars = talkingPhotos
    .filter(isCatherine)
    .map(a => ({ ...a, group: "Catherine Gomez" }))

  // Stock avatars: all v2 avatars + talking photos that aren't Catherine's
  const otherAvatars = [
    ...rawAvatars.map((a: any) => ({ ...a, group: "Stock Avatars" })),
    ...talkingPhotos
      .filter(a => !isCatherine(a))
      .map(a => ({ ...a, group: "Stock Avatars" })),
  ]

  console.log(
    `[HeyGen] avatars: ${rawAvatars.length}, talking_photos: ${talkingPhotos.length}, ` +
    `catherine: ${catherineAvatars.length}`
  )

  return NextResponse.json({
    data: { avatars: [...catherineAvatars, ...otherAvatars] },
    catherine_count: catherineAvatars.length,
  })
}
