export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const renderId = searchParams.get("renderId")
  if (!renderId) return NextResponse.json({ error: "renderId required" }, { status: 400 })

  if (!process.env.CREATOMATE_API_KEY) {
    return NextResponse.json({ error: "CREATOMATE_API_KEY not configured" }, { status: 500 })
  }

  try {
    const res = await fetch(`https://api.creatomate.com/v1/renders/${renderId}`, {
      headers: { "Authorization": `Bearer ${process.env.CREATOMATE_API_KEY}` },
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data?.message ?? JSON.stringify(data).slice(0, 200))
    }

    // Normalise — v2 may return array or object
    const render = Array.isArray(data) ? data[0] : data

    return NextResponse.json({
      status: render.status,          // "planned" | "rendering" | "succeeded" | "failed"
      url: render.url ?? null,
      errorMessage: render.error_message ?? null,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
