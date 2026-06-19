export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

// Confirmed IDs for "Catherine Gomez Avatar" group — looks in this group
// are stored as separate talking_photos.  Their sibling look IDs are
// discovered via the /api/social/heygen-avatars?mode=looks endpoint.
const PARENT_AVATAR_ID = "f2bf0415eb4f4185b37673d3c876423c"

function isCustom(name: string | undefined): boolean {
  if (!name) return false
  const n = name.toLowerCase()
  return (
    n.includes("catherine") ||
    n.includes("gomez") ||
    n.includes("swap") ||
    // "Look N" pattern — sub-looks of custom avatar groups
    /^look\s*\d+$/i.test(n) ||
    /^\d+$/.test(n.trim())
  )
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) return NextResponse.json({ error: "HEYGEN_API_KEY not set" }, { status: 500 })

  const { searchParams } = new URL(req.url)
  const mode = searchParams.get("mode") // "looks" to dump raw talking_photos names

  const headers = { "X-Api-Key": apiKey, "Content-Type": "application/json" }

  const v2Res = await fetch("https://api.heygen.com/v2/avatars", { headers })
    .then(r => r.json())
    .catch(() => null)

  const v2Avatars: any[] = v2Res?.data?.avatars ?? []
  const v2TalkingPhotos: any[] = v2Res?.data?.talking_photos ?? []

  // If mode=looks, dump all talking_photo names so the user can find the
  // 13 sub-looks of "Catherine Gomez Avatar" (they may have non-Catherine names)
  if (mode === "looks") {
    const allNames = v2TalkingPhotos.map((tp: any) => ({
      id: tp.talking_photo_id,
      name: tp.talking_photo_name,
    }))
    // Return all, sorted by name so similar names cluster together
    allNames.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
    return NextResponse.json({
      total: allNames.length,
      all_talking_photos: allNames,
    })
  }

  // Standard mode: return confirmed custom avatars
  const customTalkingPhotos = v2TalkingPhotos
    .filter((tp: any) => isCustom(tp.talking_photo_name))
    .map((tp: any) => ({
      source: "v2_talking_photo",
      avatar_id: tp.talking_photo_id,
      avatar_name: tp.talking_photo_name,
      preview_image_url: tp.preview_image_url,
    }))

  const customV2Avatars = v2Avatars
    .filter((a: any) => isCustom(a.avatar_name))
    .map((a: any) => ({
      source: "v2_avatar",
      avatar_id: a.avatar_id,
      avatar_name: a.avatar_name,
      preview_image_url: a.preview_image_url,
    }))

  return NextResponse.json({
    summary: {
      v2_avatars_total: v2Avatars.length,
      v2_talking_photos_total: v2TalkingPhotos.length,
      custom_matched: customTalkingPhotos.length + customV2Avatars.length,
    },
    talking_photo_avatars: customTalkingPhotos,
    v2_avatar_avatars: customV2Avatars,
    hint: "To find the 13 sub-looks of Catherine Gomez Avatar, visit ?mode=looks and search the list for any entries near the confirmed IDs or with Look-N style names.",
    confirmed_parent_id: PARENT_AVATAR_ID,
  })
}
