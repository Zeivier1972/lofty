export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) return NextResponse.json({ error: "HEYGEN_API_KEY not set" }, { status: 500 })

  try {
    const [avatarsRes, voicesRes] = await Promise.all([
      fetch("https://api.heygen.com/v2/avatars", { headers: { "X-Api-Key": apiKey } }),
      fetch("https://api.heygen.com/v2/voices", { headers: { "X-Api-Key": apiKey } }),
    ])

    const avatarsData = await avatarsRes.json()
    const voicesData = await voicesRes.json()

    const allAvatars: Array<{
      avatar_id: string
      avatar_name?: string
      gender?: string
      preview_image_url?: string
      type: string
    }> = [
      ...(avatarsData?.data?.avatars ?? []).map((a: Record<string, unknown>) => ({ ...a, type: "avatar" })),
      ...(avatarsData?.data?.talking_photos ?? []).map((a: Record<string, unknown>) => ({ ...a, type: "talking_photo" })),
    ]

    const cathAvatar = allAvatars.filter(a =>
      a.avatar_name?.toLowerCase().includes("catherine")
    )

    const allVoices: Array<{
      voice_id: string
      name?: string
      language?: string
      locale?: string
      gender?: string
    }> = voicesData?.data?.voices ?? []

    const spanishVoices = allVoices.filter(
      v => v.language?.toLowerCase().includes("es") || v.locale?.toLowerCase().includes("es")
    )

    return NextResponse.json({
      total_avatars: allAvatars.length,
      catherine_avatars: cathAvatar,
      all_avatars: allAvatars.map(a => ({
        avatar_id: a.avatar_id,
        avatar_name: a.avatar_name,
        gender: a.gender,
        type: a.type,
        preview_image_url: a.preview_image_url,
      })),
      total_voices: allVoices.length,
      spanish_voices: spanishVoices,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
