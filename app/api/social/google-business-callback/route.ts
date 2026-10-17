export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { googleOAuthClient, listLocations } from "@/lib/google-business"

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3000"
  const back = (q: string) => NextResponse.redirect(`${appUrl}/social?tab=accounts&${q}`)

  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")
  if (error || !code) return back(`google_error=${encodeURIComponent(error ?? "cancelled")}`)

  const creds = googleOAuthClient()
  if (!creds) return back("google_error=not_configured")

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        redirect_uri: `${appUrl}/api/social/google-business-callback`,
        grant_type: "authorization_code",
      }),
    })
    const tokens: any = await tokenRes.json().catch(() => ({}))

    if (!tokenRes.ok || !tokens.access_token) {
      return back(`google_error=${encodeURIComponent(tokens.error_description || tokens.error || "token_exchange_failed")}`)
    }
    // Without a refresh token the cron can only post for one hour. Google
    // withholds it when the app was already authorised, so the fix is to remove
    // the app's access and connect again rather than to carry on half-working.
    if (!tokens.refresh_token) return back("google_error=no_refresh_token")

    // Find the profile to post to. This is also the first real call against the
    // Business Profile API, so it surfaces a missing allowlist immediately — at
    // connect time, where someone is watching — instead of at 9am inside a cron.
    let locations
    try {
      locations = await listLocations(tokens.access_token as string)
    } catch (e) {
      return back(`google_error=${encodeURIComponent(String(e instanceof Error ? e.message : e).slice(0, 300))}`)
    }

    if (!locations.length) {
      return back("google_error=" + encodeURIComponent("La cuenta de Google no administra ningún perfil de negocio."))
    }

    const chosen = locations[0]

    const existing = await prisma.socialAccount.findFirst({ where: { platform: "GOOGLE_BUSINESS" } })
    const data = {
      // The location resource name, "accounts/x/locations/y", is what Local
      // Posts are created under — it is the address of the profile, not a user.
      accountId: chosen.name,
      accountName: chosen.title,
      accessToken: tokens.access_token as string,
      refreshToken: tokens.refresh_token as string,
      isConnected: true,
    }

    if (existing) await prisma.socialAccount.update({ where: { id: existing.id }, data })
    else await prisma.socialAccount.create({ data: { platform: "GOOGLE_BUSINESS", ...data } })

    const extra = locations.length > 1 ? `&google_note=${encodeURIComponent(`Se conectó "${chosen.title}" (de ${locations.length} perfiles).`)}` : ""
    return back(`google_connected=1${extra}`)
  } catch (e) {
    console.error("[google-business] callback failed:", e)
    return back(`google_error=${encodeURIComponent(String(e instanceof Error ? e.message : e).slice(0, 300))}`)
  }
}
