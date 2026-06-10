export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const appId = process.env.FACEBOOK_APP_ID
  const base = process.env.NEXT_PUBLIC_APP_URL!

  if (!appId) {
    return NextResponse.redirect(`${base}/integrations?error=missing_fb_app_id`)
  }

  const redirectUri = `${base}/api/auth/facebook/callback`
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: "pages_manage_ads,pages_read_engagement,leads_retrieval,pages_show_list",
    response_type: "code",
  })

  return NextResponse.redirect(
    `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`
  )
}
