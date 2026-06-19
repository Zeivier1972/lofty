export const dynamic = "force-dynamic"

// Allow up to 10 MB for photo uploads
export const maxDuration = 30
export const fetchCache = "force-no-store"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { v2 as cloudinary } from "cloudinary"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// POST /api/settings/website/upload
// Accepts either a file (multipart) or a JSON body { url: "..." }
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const contentType = req.headers.get("content-type") ?? ""

    if (contentType.includes("application/json")) {
      // URL-based upload — fetch the remote image and upload to Cloudinary
      const { url } = await req.json()
      if (!url) return NextResponse.json({ error: "No URL provided" }, { status: 400 })

      // Resolve Imgur album/page URLs to a direct image
      const resolvedUrl = resolveImgurUrl(url)

      const result = await cloudinary.uploader.upload(resolvedUrl, {
        folder: "lofty-website",
        resource_type: "image",
      })
      return NextResponse.json({ url: result.secure_url })
    }

    // File upload
    const formData = await req.formData()
    const file = formData.get("file") as File
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString("base64")
    const dataUri = `data:${file.type};base64,${base64}`

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "lofty-website",
      resource_type: "image",
    })
    return NextResponse.json({ url: result.secure_url })
  } catch (e: any) {
    console.error("[website-upload] Error:", e)
    return NextResponse.json({ error: e.message ?? "Upload failed" }, { status: 500 })
  }
}

// Convert Imgur album/page URLs to a direct image URL that Cloudinary can fetch.
// https://imgur.com/a/87oprxF  →  https://i.imgur.com/87oprxF.jpg
// https://imgur.com/87oprxF   →  https://i.imgur.com/87oprxF.jpg
function resolveImgurUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname.includes("imgur.com") && !u.hostname.startsWith("i.")) {
      // Extract last path segment (album or image ID)
      const id = u.pathname.replace(/^\/(a\/)?/, "").replace(/\/$/, "")
      return `https://i.imgur.com/${id}.jpg`
    }
  } catch {
    // Not a valid URL — return as-is and let Cloudinary handle the error
  }
  return url
}
