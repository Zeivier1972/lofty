export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

// Proxy recording URLs so the browser can play them.
// Twilio recording URLs need Basic Auth; VAPI/S3 URLs are direct.
export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const url = searchParams.get("url")
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 })

  const headers: Record<string, string> = {}

  // Twilio recordings require Basic Auth
  if (url.includes("api.twilio.com") || url.includes("twilio.com/2010")) {
    const sid = process.env.TWILIO_ACCOUNT_SID
    const token = process.env.TWILIO_AUTH_TOKEN
    if (sid && token) {
      headers["Authorization"] = `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`
    }
  }

  try {
    const res = await fetch(url, { headers })
    if (!res.ok) return NextResponse.json({ error: "Recording not found" }, { status: 404 })

    const contentType = res.headers.get("content-type") || "audio/mpeg"
    const buffer = await res.arrayBuffer()

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (e: any) {
    console.error("[recording-proxy]", e.message)
    return NextResponse.json({ error: "Failed to fetch recording" }, { status: 500 })
  }
}
