export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

// Read the HeyGen API balance directly.
//
// HeyGen keeps two separate pools and the dashboard only makes one of them
// obvious: Studio credits, spent when a video is made by hand on the website,
// and the API quota this key draws on. A full Studio balance says nothing about
// the second, which is why "Insufficient credits. Upgrade to continue." (HTTP
// 402, code insufficient_credit) can come back while the account looks funded.
//
// So report the number that actually governs Content Studio rather than guessing
// at it from the render failure.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const key = process.env.HEYGEN_API_KEY
  if (!key) return NextResponse.json({ error: "HEYGEN_API_KEY not configured" }, { status: 500 })

  try {
    const res = await fetch("https://api.heygen.com/v2/user/remaining_quota", {
      headers: { "X-Api-Key": key, Accept: "application/json" },
      cache: "no-store",
    })
    const data = await res.json().catch(() => null)

    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        status: res.status,
        detail: data,
        hint: res.status === 401
          ? "HeyGen rejected the API key. Regenerate it under Settings → API and update HEYGEN_API_KEY."
          : "HeyGen would not report the quota. The detail field carries its exact answer.",
      }, { status: 200 })
    }

    // HeyGen reports the balance in API credits; a credit is a minute of video.
    const d = data?.data ?? data
    const quota = d?.remaining_quota ?? d?.remaining ?? null

    return NextResponse.json({
      ok: true,
      remainingApiCredits: quota,
      approxMinutesOfVideo: typeof quota === "number" ? quota : null,
      canRender: typeof quota === "number" ? quota > 0 : null,
      note: "This is the API balance Content Studio spends. Studio credits shown on the HeyGen website are a separate pool and do not top this up.",
      raw: data,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 200 })
  }
}
