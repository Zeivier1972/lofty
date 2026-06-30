export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) return NextResponse.json({ error: "HEYGEN_API_KEY not set" }, { status: 500 })

  const { searchParams } = new URL(req.url)
  const testVideo = searchParams.get("test") === "1"

  const [avatarsRes, voicesRes, photoAvatarsRes] = await Promise.all([
    fetch("https://api.heygen.com/v2/avatars", { headers: { "X-Api-Key": apiKey } }),
    fetch("https://api.heygen.com/v2/voices", { headers: { "X-Api-Key": apiKey } }),
    fetch("https://api.heygen.com/v2/photo_avatar", { headers: { "X-Api-Key": apiKey } }),
  ])

  const avatarsData = await avatarsRes.json()
  const voicesData = await voicesRes.json()
  const photoAvatarsData = await photoAvatarsRes.json().catch(() => null)

  const rawTalkingPhotos: any[] = avatarsData?.data?.talking_photos ?? []
  const talkingPhotos = rawTalkingPhotos.map((tp: any) => ({
    id: tp.talking_photo_id || tp.id || tp.avatar_id,
    name: tp.talking_photo_name || tp.name || tp.avatar_name,
    preview: tp.preview_image_url,
  }))

  const voices: any[] = voicesData?.data?.voices ?? []
  const spanishVoices = voices
    .filter((v: any) => v.language?.toLowerCase().includes("es") || v.locale?.toLowerCase().includes("es"))
    .map((v: any) => ({ id: v.voice_id, name: v.name, gender: v.gender, language: v.language }))

  // Pick the first available talking photo and Spanish female voice for test
  const firstAvatar = talkingPhotos[0]
  const spanishFemale = voices.find(
    (v: any) => (v.language?.toLowerCase().includes("es") || v.locale?.toLowerCase().includes("es")) && v.gender?.toLowerCase() === "female"
  )
  const firstSpanishVoice = spanishVoices[0]

  let testVideoResult: any = null
  if (testVideo && firstAvatar && (spanishFemale || firstSpanishVoice)) {
    const voiceId = spanishFemale?.voice_id ?? firstSpanishVoice?.id
    const payload = {
      video_inputs: [{
        character: { type: "talking_photo", talking_photo_id: firstAvatar.id },
        voice: { type: "text", input_text: "Hola, soy Catherine Gomez, tu Realtor en Miami.", voice_id: voiceId },
      }],
      dimension: { width: 720, height: 1280 },
      test: true,
    }
    const genRes = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    testVideoResult = { status: genRes.status, body: await genRes.json(), payload }
  }

  return NextResponse.json({
    avatarsStatus: avatarsRes.status,
    talkingPhotos,
    talkingPhotosCount: talkingPhotos.length,
    regularAvatars: (avatarsData?.data?.avatars ?? []).map((a: any) => ({
      id: a.avatar_id,
      name: a.avatar_name,
      gender: a.gender,
      preview: a.preview_image_url,
    })),
    regularAvatarsCount: (avatarsData?.data?.avatars ?? []).length,
    spanishVoices,
    firstSelectedAvatar: firstAvatar ?? null,
    firstSelectedVoice: spanishFemale ? { id: spanishFemale.voice_id, name: spanishFemale.name } : (firstSpanishVoice ?? null),
    testVideoResult,
    rawAvatarsData: avatarsData,
    photoAvatarsData,
  })
}
