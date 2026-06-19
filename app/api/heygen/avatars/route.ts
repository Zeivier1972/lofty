export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

// Catherine Gomez "8 looks" — hardcoded, confirmed by user
// These are talking_photo type and don't appear in /v2/avatars API response
const CATHERINE_LOOKS = [
  { avatar_id: "ab393d45f3044a89b92fc77d17f321b7", avatar_name: "Catherine Gomez — Look 1", is_talking_photo: true, group: "Catherine Gomez" },
  { avatar_id: "28e35d5f82f64101a2584fb29e841a88", avatar_name: "Catherine Gomez — Look 2", is_talking_photo: true, group: "Catherine Gomez" },
  { avatar_id: "ad3b10e46ce44ad8b9a9931f65e151cf", avatar_name: "Catherine Gomez — Look 3", is_talking_photo: true, group: "Catherine Gomez" },
  { avatar_id: "7ec891d9cc9f43ffa0f38f67d945d38f", avatar_name: "Catherine Gomez — Look 4", is_talking_photo: true, group: "Catherine Gomez" },
  { avatar_id: "0215c5d293fb4c89b42130da184ded5b", avatar_name: "Catherine Gomez — Look 5", is_talking_photo: true, group: "Catherine Gomez" },
  { avatar_id: "bc75573c848f42218ee27d37e623a4e6", avatar_name: "Catherine Gomez — Look 6", is_talking_photo: true, group: "Catherine Gomez" },
  { avatar_id: "701d93d2d1834f2589a987aaf701720d", avatar_name: "Catherine Gomez — Look 7", is_talking_photo: true, group: "Catherine Gomez" },
  { avatar_id: "f2bf0415eb4f4185b37673d3c876423c", avatar_name: "Catherine Gomez — Look 8", is_talking_photo: true, group: "Catherine Gomez" },
  { avatar_id: "310728040e89413aa1c5b04ebb8bb9d3", avatar_name: "Catherine Gomez — Look 9", is_talking_photo: true, group: "Catherine Gomez" },
]

const CATHERINE_IDS = new Set(CATHERINE_LOOKS.map(c => c.avatar_id))

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

  // Stock avatars: everything that is NOT one of Catherine's confirmed IDs and not named "catherine"
  const stockAvatars = rawAvatars
    .filter((a: any) => !CATHERINE_IDS.has(a.avatar_id) && !a.avatar_name?.toLowerCase().includes("catherine"))
    .map((a: any) => ({ ...a, group: "Stock Avatars" }))

  return NextResponse.json({
    data: { avatars: [...CATHERINE_LOOKS, ...stockAvatars] },
    catherine_count: CATHERINE_LOOKS.length,
  })
}
