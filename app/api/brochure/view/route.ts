export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { v2 as cloudinary } from "cloudinary"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

function extractPublicId(url: string): string {
  // e.g. https://res.cloudinary.com/{cloud}/raw/upload/v123/{folder}/{file}.pdf
  // public_id = {folder}/{file}  (no extension for raw uploads)
  const match = url.match(/\/raw\/upload\/(?:v\d+\/)?(.+)$/)
  if (!match) return ""
  // Remove .pdf extension — Cloudinary public_id doesn't include it for raw
  return match[1].replace(/\.pdf$/i, "")
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })

  const url = req.nextUrl.searchParams.get("url")
  if (!url) return new NextResponse("Missing url", { status: 400 })

  // Only handle Cloudinary URLs
  if (!url.startsWith("https://res.cloudinary.com/")) {
    return NextResponse.redirect(url)
  }

  try {
    // Generate a signed URL valid for 1 hour — bypasses access restrictions
    const publicId = extractPublicId(url)
    if (publicId) {
      const signedUrl = cloudinary.url(publicId, {
        resource_type: "raw",
        type: "upload",
        sign_url: true,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      })
      return NextResponse.redirect(signedUrl)
    }

    // Fallback: proxy the bytes directly
    const res = await fetch(url)
    if (!res.ok) return new NextResponse(`PDF fetch failed: ${res.status}`, { status: 502 })
    const buffer = await res.arrayBuffer()
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (e: any) {
    return new NextResponse(`Error: ${e.message}`, { status: 500 })
  }
}
