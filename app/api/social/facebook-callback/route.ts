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
      `${appUrl}/social?tab=accounts&fb_error=${encodeURIComponent(error ?? "cancelled")}`
    )
  }

  const appId = process.env.FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET
  const redirectUri = `${appUrl}/api/social/facebook-callback`

  if (!appId || !appSecret) {
    return NextResponse.redirect(`${appUrl}/social?tab=accounts&fb_error=not_configured`)
  }

  try {
    // 1. Exchange code for short-lived user access token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
        new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code })
    )
    const tokenData = await tokenRes.json()
    if (tokenData.error) throw new Error(tokenData.error.message)
    const shortToken: string = tokenData.access_token

    // 2. Exchange for long-lived user access token (60-day)
    const longRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
        new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: shortToken,
        })
    )
    const longData = await longRes.json()
    const longToken: string = longData.access_token ?? shortToken

    // 3. Get all Pages the user manages
    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${longToken}`
    )
    const pagesData = await pagesRes.json()
    const pages: Array<{ id: string; name: string; access_token: string }> =
      pagesData.data ?? []

    if (pages.length === 0) {
      return NextResponse.redirect(
        `${appUrl}/social?tab=accounts&fb_error=no_pages_found`
      )
    }

    // Use the first page (Catherine only has one)
    const page = pages[0]
    const pageToken: string = page.access_token  // Page tokens don't expire

    // 4. Save / update Facebook account
    const existingFb = await prisma.socialAccount.findFirst({ where: { platform: "FACEBOOK" } })
    if (existingFb) {
      await prisma.socialAccount.update({
        where: { id: existingFb.id },
        data: {
          accountId: page.id,
          accountName: page.name,
          accessToken: pageToken,
          pageId: page.id,
          isConnected: true,
        },
      })
    } else {
      await prisma.socialAccount.create({
        data: {
          platform: "FACEBOOK",
          accountId: page.id,
          accountName: page.name,
          accessToken: pageToken,
          pageId: page.id,
          isConnected: true,
        },
      })
    }

    // 5. Get the Instagram Business Account linked to this page
    const igRes = await fetch(
      `https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account&access_token=${pageToken}`
    )
    const igData = await igRes.json()
    const igId: string | undefined = igData.instagram_business_account?.id

    if (igId) {
      // Get Instagram account name
      const igProfileRes = await fetch(
        `https://graph.facebook.com/v19.0/${igId}?fields=name,username&access_token=${pageToken}`
      )
      const igProfile = await igProfileRes.json()
      const igName: string = igProfile.username ?? igProfile.name ?? "Instagram"

      // Save / update Instagram account
      const existingIg = await prisma.socialAccount.findFirst({ where: { platform: "INSTAGRAM" } })
      if (existingIg) {
        await prisma.socialAccount.update({
          where: { id: existingIg.id },
          data: {
            accountId: igId,
            accountName: igName,
            accessToken: pageToken,  // Instagram API uses the Page token
            pageId: igId,            // Instagram uses its own Business Account ID
            isConnected: true,
          },
        })
      } else {
        await prisma.socialAccount.create({
          data: {
            platform: "INSTAGRAM",
            accountId: igId,
            accountName: igName,
            accessToken: pageToken,
            pageId: igId,
            isConnected: true,
          },
        })
      }

      return NextResponse.redirect(
        `${appUrl}/social?tab=accounts&fb_connected=true&ig_connected=true`
      )
    }

    // Facebook connected but no Instagram linked
    return NextResponse.redirect(
      `${appUrl}/social?tab=accounts&fb_connected=true`
    )
  } catch (err: any) {
    console.error("[facebook-callback] Error:", err)
    return NextResponse.redirect(
      `${appUrl}/social?tab=accounts&fb_error=${encodeURIComponent(err.message ?? "unknown_error")}`
    )
  }
}
