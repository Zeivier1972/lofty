export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXTAUTH_URL || "https://lofty-production.up.railway.app"
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  if (error || !code) {
    return NextResponse.redirect(
      `${appUrl}/social?tab=accounts&tt_error=${encodeURIComponent(error ?? "cancelled")}`
    )
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET
  const redirectUri = `${appUrl}/api/social/tiktok-callback`

  if (!clientKey || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/social?tab=accounts&tt_error=not_configured`)
  }

  try {
    // 1. Exchange code for access token
    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    })
    const tokenData = await tokenRes.json()

    if (tokenData.error) {
      throw new Error(tokenData.error_description ?? tokenData.error)
    }

    const { access_token, refresh_token, open_id } = tokenData.data ?? tokenData

    if (!access_token || !open_id) {
      throw new Error("No access_token or open_id in TikTok response")
    }

    // 2. Get TikTok user display name
    const userRes = await fetch(
      "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url",
      { headers: { Authorization: `Bearer ${access_token}` } }
    )
    const userData = await userRes.json()
    const displayName: string = userData.data?.user?.display_name ?? "TikTok Account"

    // 3. Save / update TikTok account
    const existing = await prisma.socialAccount.findFirst({ where: { platform: "TIKTOK" } })
    if (existing) {
      await prisma.socialAccount.update({
        where: { id: existing.id },
        data: {
          accountId: open_id,
          accountName: displayName,
          accessToken: access_token,
          refreshToken: refresh_token ?? null,
          isConnected: true,
        },
      })
    } else {
      await prisma.socialAccount.create({
        data: {
          platform: "TIKTOK",
          accountId: open_id,
          accountName: displayName,
          accessToken: access_token,
          refreshToken: refresh_token ?? null,
          isConnected: true,
        },
      })
    }

    console.log(`[tiktok-callback] Connected TikTok account: ${displayName} (${open_id})`)
    return NextResponse.redirect(`${appUrl}/social?tab=accounts&tt_connected=true`)
  } catch (err: any) {
    console.error("[tiktok-callback] Error:", err)
    return NextResponse.redirect(
      `${appUrl}/social?tab=accounts&tt_error=${encodeURIComponent(err.message ?? "unknown_error")}`
    )
  }
}
