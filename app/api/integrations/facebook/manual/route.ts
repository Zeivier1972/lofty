export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { userToken } = await req.json()
  if (!userToken) return NextResponse.json({ error: "userToken required" }, { status: 400 })

  const appId = process.env.FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET
  if (!appId || !appSecret) {
    return NextResponse.json({ error: "FACEBOOK_APP_ID and FACEBOOK_APP_SECRET not configured in Railway" }, { status: 500 })
  }

  // Exchange short-lived user token for long-lived (60-day) user token
  const llRes = await fetch(
    `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token` +
    `&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${encodeURIComponent(userToken)}`
  )
  const llData = await llRes.json()
  if (llData.error) {
    console.error("[FB manual] Token exchange error:", llData.error)
    return NextResponse.json({ error: `Token inválido: ${llData.error.message}` }, { status: 400 })
  }
  const longLivedToken = llData.access_token || userToken

  // Get pages via /me/accounts (permanent page tokens when derived from long-lived user token)
  let pages: any[] = []
  const pagesRes = await fetch(
    `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token&access_token=${longLivedToken}&limit=50`
  )
  const pagesData = await pagesRes.json()
  pages = pagesData.data || []

  // Fallback: Business Manager pages
  if (pages.length === 0) {
    console.log("[FB manual] No pages from /me/accounts, trying Business Manager...")
    const bizRes = await fetch(
      `https://graph.facebook.com/v18.0/me/businesses?fields=id,name&access_token=${longLivedToken}`
    )
    const bizData = await bizRes.json()
    for (const biz of bizData.data || []) {
      const bizPagesRes = await fetch(
        `https://graph.facebook.com/v18.0/${biz.id}/owned_pages?fields=id,name,access_token&access_token=${longLivedToken}&limit=50`
      )
      const bizPagesData = await bizPagesRes.json()
      pages = [...pages, ...(bizPagesData.data || [])]
    }
  }

  if (pages.length === 0) {
    return NextResponse.json({
      error: "No se encontraron páginas. Asegúrate de incluir los permisos: pages_show_list, leads_retrieval, pages_read_engagement, business_management"
    }, { status: 404 })
  }

  const saved: { id: string; name: string }[] = []

  for (const page of pages) {
    // Subscribe page to leadgen webhook
    try {
      const subRes = await fetch(`https://graph.facebook.com/v18.0/${page.id}/subscribed_apps`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ subscribed_fields: "leadgen", access_token: page.access_token }).toString(),
      })
      const subData = await subRes.json()
      console.log(`[FB manual] Subscription for page ${page.id}:`, subData)
    } catch (e) {
      console.error(`[FB manual] Subscription error for page ${page.id}:`, e)
    }

    const existing = await prisma.socialAccount.findFirst({
      where: { platform: "FACEBOOK", pageId: page.id },
    })

    if (existing) {
      await prisma.socialAccount.update({
        where: { id: existing.id },
        data: { accountName: page.name, accessToken: page.access_token, isConnected: true, subscribedToLeads: true },
      })
    } else {
      await prisma.socialAccount.create({
        data: { platform: "FACEBOOK", pageId: page.id, accountName: page.name, accessToken: page.access_token, isConnected: true, subscribedToLeads: true },
      })
    }

    saved.push({ id: page.id, name: page.name })
  }

  return NextResponse.json({ success: true, pages: saved })
}
