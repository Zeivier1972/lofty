export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3000"
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  if (error || !code) {
    return NextResponse.redirect(
      `${appUrl}/social?tab=accounts&youtube_error=${encodeURIComponent(error ?? "cancelled")}`
    )
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET
  const redirectUri = `${appUrl}/api/social/youtube-callback`

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/social?tab=accounts&youtube_error=not_configured`)
  }

  try {
    // Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    })

    const tokens = await tokenRes.json()

    if (!tokens.refresh_token) {
      // Google only returns refresh_token on first authorization — if missing, user needs to revoke and re-authorize
      return NextResponse.redirect(
        `${appUrl}/social?tab=accounts&youtube_error=no_refresh_token`
      )
    }

    // Fetch channel details
    const channelRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    )
    const channelData = await channelRes.json()
    const channel = channelData.items?.[0]
    const channelId = (channel?.id as string) ?? ""
    const channelName = (channel?.snippet?.title as string) ?? "YouTube Channel"

    // Upsert the YouTube SocialAccount
    const existing = await prisma.socialAccount.findFirst({ where: { platform: "YOUTUBE" } })

    if (existing) {
      await prisma.socialAccount.update({
        where: { id: existing.id },
        data: {
          accountId: channelId,
          accountName: channelName,
          accessToken: tokens.access_token as string,
          refreshToken: tokens.refresh_token as string,
          isConnected: true,
        },
      })
    } else {
      await prisma.socialAccount.create({
        data: {
          platform: "YOUTUBE",
          accountId: channelId,
          accountName: channelName,
          accessToken: tokens.access_token as string,
          refreshToken: tokens.refresh_token as string,
          isConnected: true,
        },
      })
    }

    return NextResponse.redirect(`${appUrl}/social?tab=accounts&youtube_connected=1`)
  } catch (err) {
    console.error("[youtube-callback] Error:", err)
    return NextResponse.redirect(`${appUrl}/social?tab=accounts&youtube_error=server_error`)
  }
}
