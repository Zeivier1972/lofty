export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) return NextResponse.json({ error: "HEYGEN_API_KEY not set" }, { status: 500 })

  const [avatarsRes, voicesRes] = await Promise.all([
    fetch("https://api.heygen.com/v2/avatars", { headers: { "X-Api-Key": apiKey } }),
    fetch("https://api.heygen.com/v2/voices", { headers: { "X-Api-Key": apiKey } }),
  ])

  const avatarsData = await avatarsRes.json()
  const voicesData = await voicesRes.json()

  const talkingPhotos = (avatarsData?.data?.talking_photos ?? []).map((tp: any) => ({
    id: tp.talking_photo_id || tp.id || tp.avatar_id,
    name: tp.talking_photo_name || tp.name || tp.avatar_name,
    preview: tp.preview_image_url,
  }))

  const spanishVoices = (voicesData?.data?.voices ?? []).filter((v: any) =>
    v.language?.toLowerCase().includes("es") || v.locale?.toLowerCase().includes("es")
  ).map((v: any) => ({ id: v.voice_id, name: v.name, gender: v.gender, language: v.language }))

  return NextResponse.json({ talkingPhotos, spanishVoices })
}
