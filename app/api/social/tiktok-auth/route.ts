export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY
  const appUrl = process.env.NEXTAUTH_URL || "https://lofty-production.up.railway.app"

  if (!clientKey) {
    return NextResponse.redirect(
      `${appUrl}/social?tab=accounts&tt_error=TIKTOK_CLIENT_KEY+not+configured`
    )
  }

  const redirectUri = `${appUrl}/api/social/tiktok-callback`

  const params = new URLSearchParams({
    client_key: clientKey,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "user.info.basic,video.upload,video.publish",
    state: Buffer.from(Date.now().toString()).toString("base64"),
  })

  return NextResponse.redirect(
    `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`
  )
}
