export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

// Avatars offered by Content Studio.
//
// This used to serve a hardcoded list of nine "Catherine Gomez — Look N" ids and
// then filter anything named "catherine" out of everything else. Between the two
// rules a newly recorded avatar was invisible: absent from the fixed list, and
// excluded from the rest by its own name. It also read only data.avatars, while
// HeyGen returns custom photo avatars under data.talking_photos in the same
// response — which is where Catherine's looks actually live.
//
// So read both collections and return what the account really has. The nine ids
// stay only as a hint for grouping, never as the source of truth.
const KNOWN_CATHERINE_IDS = new Set([
  "ab393d45f3044a89b92fc77d17f321b7",
  "28e35d5f82f64101a2584fb29e841a88",
  "ad3b10e46ce44ad8b9a9931f65e151cf",
  "7ec891d9cc9f43ffa0f38f67d945d38f",
  "0215c5d293fb4c89b42130da184ded5b",
  "bc75573c848f42218ee27d37e623a4e6",
  "701d93d2d1834f2589a987aaf701720d",
  "f2bf0415eb4f4185b37673d3c876423c",
  "310728040e89413aa1c5b04ebb8bb9d3",
])

// A custom avatar is Catherine's if we already knew the id, or if its name says
// so. Newly recorded looks are often named "Look 3" or just "3", so treat any
// talking photo as hers unless it is plainly a HeyGen stock character.
function isCatherine(id: string, name: string | undefined, isTalkingPhoto: boolean): boolean {
  if (KNOWN_CATHERINE_IDS.has(id)) return true
  const n = (name || "").toLowerCase()
  if (n.includes("catherine") || n.includes("gomez")) return true
  if (isTalkingPhoto && (/^look\s*\d+$/.test(n.trim()) || /^\d+$/.test(n.trim()))) return true
  return isTalkingPhoto
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.HEYGEN_API_KEY) {
    return NextResponse.json({ error: "HEYGEN_API_KEY not configured" }, { status: 500 })
  }

  try {
    const res = await fetch("https://api.heygen.com/v2/avatars", {
      headers: { "X-Api-Key": process.env.HEYGEN_API_KEY },
      cache: "no-store",
    })
    const data = await res.json()

    if (!res.ok) {
      console.error(`[heygen/avatars] HTTP ${res.status}:`, JSON.stringify(data).slice(0, 400))
      return NextResponse.json(
        { error: data?.error?.message || `HeyGen returned ${res.status}`, detail: data },
        { status: 502 },
      )
    }

    const rawAvatars: any[] = data?.data?.avatars ?? []
    const rawTalkingPhotos: any[] = data?.data?.talking_photos ?? []

    const normalized = [
      ...rawTalkingPhotos.map((tp: any) => ({
        avatar_id: tp.talking_photo_id || tp.id || tp.avatar_id,
        avatar_name: tp.talking_photo_name || tp.name || tp.avatar_name || "Sin nombre",
        preview_image_url: tp.preview_image_url || tp.image_url || null,
        is_talking_photo: true,
      })),
      ...rawAvatars.map((a: any) => ({
        avatar_id: a.avatar_id,
        avatar_name: a.avatar_name || "Sin nombre",
        preview_image_url: a.preview_image_url || null,
        is_talking_photo: false,
      })),
    ].filter(a => a.avatar_id)

    const mine = normalized.filter(a => isCatherine(a.avatar_id, a.avatar_name, a.is_talking_photo))
    const mineIds = new Set(mine.map(a => a.avatar_id))
    const stock = normalized.filter(a => !mineIds.has(a.avatar_id))

    console.log(
      `[heygen/avatars] ${normalized.length} total — ${rawTalkingPhotos.length} talking photos, ` +
      `${rawAvatars.length} avatars | mine: ${mine.length}, stock: ${stock.length}`,
    )

    return NextResponse.json({
      data: {
        avatars: [
          ...mine.map(a => ({ ...a, group: "Catherine Gomez" })),
          ...stock.map(a => ({ ...a, group: "Stock Avatars" })),
        ],
      },
      // Counts make "my new avatar is missing" answerable without reading code:
      // if talkingPhotos is 0, HeyGen is not returning it and the problem is there.
      counts: {
        total: normalized.length,
        talkingPhotos: rawTalkingPhotos.length,
        avatars: rawAvatars.length,
        catherine: mine.length,
        stock: stock.length,
      },
      catherine_count: mine.length,
    })
  } catch (e: any) {
    console.error("[heygen/avatars] exception:", e)
    return NextResponse.json({ error: e?.message || "Failed to load avatars" }, { status: 500 })
  }
}
