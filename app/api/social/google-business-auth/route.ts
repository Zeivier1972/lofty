export const dynamic = "force-dynamic"

// Connects Catherine's Google Business Profile so the CRM can publish Local
// Posts to it.
//
// Required Railway env vars (the YouTube pair is accepted as a fallback, since
// it is normally the same Google Cloud project):
//   GOOGLE_BUSINESS_CLIENT_ID     — Google Cloud Console → APIs & Services → OAuth 2.0
//   GOOGLE_BUSINESS_CLIENT_SECRET — same credential
//   NEXTAUTH_URL                  — this app's base URL
//
// That Cloud project also needs the Business Profile API enabled AND an
// approved access request — until Google approves it the quota is 0 and every
// call returns 429, however correct the OAuth flow is.

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { googleOAuthClient, GOOGLE_BUSINESS_SCOPE } from "@/lib/google-business"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const appUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3000"
  const creds = googleOAuthClient()
  if (!creds) {
    return NextResponse.redirect(
      `${appUrl}/social?tab=accounts&google_error=${encodeURIComponent("GOOGLE_BUSINESS_CLIENT_ID no está configurado en Railway")}`,
    )
  }

  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: `${appUrl}/api/social/google-business-callback`,
    response_type: "code",
    scope: GOOGLE_BUSINESS_SCOPE,
    // Posts are published by a cron with nobody at the keyboard, so a refresh
    // token is mandatory. Google only returns one on the first consent, hence
    // prompt=consent — otherwise a reconnect yields an access token that dies
    // in an hour and the autopilot silently stops.
    access_type: "offline",
    prompt: "consent",
  })

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
}
