export const dynamic = "force-dynamic"

// Required Railway env vars:
//   YOUTUBE_CLIENT_ID     — Google Cloud Console → APIs & Services → OAuth 2.0 → Client ID
//   YOUTUBE_CLIENT_SECRET — same credential
//   NEXTAUTH_URL          — your app's base URL (e.g. https://lofty.up.railway.app)
// Scopes requested: youtube.upload + youtube.readonly (read channel info)

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID
  const appUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3000"

  if (!clientId) {
    return NextResponse.redirect(`${appUrl}/social?tab=accounts&youtube_error=YOUTUBE_CLIENT_ID+not+configured`)
  }

  const redirectUri = `${appUrl}/api/social/youtube-callback`

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
    access_type: "offline",
    prompt: "consent",
  })

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  )
}
