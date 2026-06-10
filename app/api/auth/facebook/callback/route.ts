export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(req: Request) {
  const session = await auth()
  const base = process.env.NEXT_PUBLIC_APP_URL!

  if (!session) return NextResponse.redirect(`${base}/login`)

  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  if (error || !code) {
    return NextResponse.redirect(`${base}/integrations?error=fb_denied`)
  }

  const appId = process.env.FACEBOOK_APP_ID!
  const appSecret = process.env.FACEBOOK_APP_SECRET!
  const redirectUri = `${base}/api/auth/facebook/callback`

  try {
    // Exchange code for short-lived user token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?` +
      `client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
    )
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) {
      console.error("[FB OAuth] Token exchange failed:", tokenData)
      return NextResponse.redirect(`${base}/integrations?error=fb_token_failed`)
    }

    // Exchange for long-lived user token (60 days)
    const llRes = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?` +
      `grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`
    )
    const llData = await llRes.json()
    const userToken = llData.access_token || tokenData.access_token

    // Get pages — tokens from long-lived user token are permanent
    const pagesRes = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,category&access_token=${userToken}`
    )
    const pagesData = await pagesRes.json()
    const pages: any[] = pagesData.data || []

    if (pages.length === 0) {
      return NextResponse.redirect(`${base}/integrations?error=no_pages`)
    }

    for (const page of pages) {
      // Subscribe page to leadgen webhook events
      try {
        await fetch(`https://graph.facebook.com/v18.0/${page.id}/subscribed_apps`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            subscribed_fields: "leadgen",
            access_token: page.access_token,
          }).toString(),
        })
      } catch (subErr) {
        console.error(`[FB OAuth] Subscription failed for page ${page.id}:`, subErr)
      }

      const existing = await prisma.socialAccount.findFirst({
        where: { platform: "FACEBOOK", pageId: page.id },
      })

      if (existing) {
        await prisma.socialAccount.update({
          where: { id: existing.id },
          data: {
            accountName: page.name,
            accessToken: page.access_token,
            isConnected: true,
            subscribedToLeads: true,
          },
        })
      } else {
        await prisma.socialAccount.create({
          data: {
            platform: "FACEBOOK",
            pageId: page.id,
            accountName: page.name,
            accessToken: page.access_token,
            isConnected: true,
            subscribedToLeads: true,
          },
        })
      }
    }

    return NextResponse.redirect(`${base}/integrations?success=facebook`)
  } catch (e: any) {
    console.error("[FB OAuth] Error:", e.message)
    return NextResponse.redirect(`${base}/integrations?error=fb_error`)
  }
}
