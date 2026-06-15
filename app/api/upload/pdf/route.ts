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

  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    return NextResponse.json({ error: "Cloudinary not configured" }, { status: 500 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "El PDF no puede superar 20 MB" }, { status: 400 })
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Solo se permiten archivos PDF" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const originalName = file.name.replace(/\.pdf$/i, "").replace(/[^a-z0-9]/gi, "_")

    const result = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: "raw",
          folder: "lofty-crm/brochures",
          public_id: `${originalName}_${Date.now()}`,
          format: "pdf",
        },
        (error, result) => { if (error) reject(error); else resolve(result) }
      )
      stream.end(buffer)
    })

    return NextResponse.json({ url: result.secure_url, name: file.name })
  } catch (e: any) {
    console.error("[PDF Upload] Error:", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
