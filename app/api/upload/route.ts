export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { v2 as cloudinary } from "cloudinary"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET must be set in Railway" },
      { status: 500 }
    )
  }

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

    // Check size limit (10 MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "El archivo no puede superar 10 MB" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const isVideo = file.type.startsWith("video/")
    const isAudio = file.type.startsWith("audio/")
    // Cloudinary uses resource_type "video" for both video and audio files
    const resourceType = isVideo || isAudio ? "video" : "image"
    const folder = isAudio ? "lofty-voicemails" : "lofty-crm"

    const result = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: resourceType, folder },
        (error, result) => { if (error) reject(error); else resolve(result) }
      )
      stream.end(buffer)
    })

    const type = isAudio ? "audio" : isVideo ? "video" : "image"
    return NextResponse.json({ url: result.secure_url, type })
  } catch (e: any) {
    console.error("[Upload] Error:", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
