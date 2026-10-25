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
    // pages_messaging is what lets Sofía answer Messenger DMs. It was missing here,
    // so the connect flow never asked for it and the page tokens it returns could not
    // send — the messaging token had to be minted by hand in Business Manager instead.
    // App Review also expects to watch a user grant the permission being requested,
    // which is impossible if the app never asks for it.
    scope: "pages_show_list,leads_retrieval,pages_read_engagement,business_management,pages_messaging",
    response_type: "code",
    auth_type: "rerequest",
  })

  return NextResponse.redirect(
    `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`
  )
}
