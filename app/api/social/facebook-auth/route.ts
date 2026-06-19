export const dynamic = "force-dynamic"

// Required Railway env vars:
//   FACEBOOK_APP_ID     — Meta Developer Portal → Your App → Settings → Basic → App ID
//   FACEBOOK_APP_SECRET — same page → App Secret
//   NEXTAUTH_URL        — your app's base URL (e.g. https://lofty.up.railway.app)
//
// Permissions requested:
//   pages_manage_posts, pages_read_engagement,
//   instagram_basic, instagram_content_publish

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const appId = process.env.FACEBOOK_APP_ID
  const appUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3000"

  if (!appId) {
    return NextResponse.redirect(
      `${appUrl}/social?tab=accounts&fb_error=FACEBOOK_APP_ID+not+configured`
    )
  }

  const redirectUri = `${appUrl}/api/social/facebook-callback`

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [
      "pages_manage_posts",
      "pages_read_engagement",
      "pages_show_list",
      "instagram_basic",
      "instagram_content_publish",
    ].join(","),
  })

  return NextResponse.redirect(
    `https://www.facebook.com/dialog/oauth?${params.toString()}`
  )
}
