export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })

  const url = req.nextUrl.searchParams.get("url")
  if (!url) return new NextResponse("Missing url", { status: 400 })

  // Only proxy Cloudinary URLs for security
  if (!url.startsWith("https://res.cloudinary.com/")) {
    return NextResponse.redirect(url)
  }

  try {
    const res = await fetch(url)
    if (!res.ok) return new NextResponse("PDF not found", { status: 404 })
    const buffer = await res.arrayBuffer()
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "public, max-age=86400",
      },
    })
  } catch {
    return new NextResponse("Failed to load PDF", { status: 500 })
  }
}
