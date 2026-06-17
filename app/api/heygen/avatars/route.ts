export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

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

  // Normalize talking_photos to the same shape as avatars so the client
  // sees all custom looks (Photo Avatar, Chic Elegance, etc.)
  const avatars: any[] = data?.data?.avatars || []
  const talkingPhotos: any[] = (data?.data?.talking_photos || []).map((tp: any) => ({
    avatar_id: tp.talking_photo_id,
    avatar_name: tp.talking_photo_name,
    preview_image_url: tp.preview_image_url || tp.preview_url || null,
  }))

  return NextResponse.json({
    data: { avatars: [...avatars, ...talkingPhotos] },
  })
}
