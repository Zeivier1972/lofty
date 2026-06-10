export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { pageId, pageName, accessToken } = await req.json()
  if (!pageId || !pageName || !accessToken) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  }

  // Subscribe page to leadgen webhook events
  try {
    await fetch(`https://graph.facebook.com/v18.0/${pageId}/subscribed_apps`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ subscribed_fields: "leadgen", access_token: accessToken }).toString(),
    })
  } catch {}

  const existing = await prisma.socialAccount.findFirst({
    where: { platform: "FACEBOOK", pageId },
  })

  if (existing) {
    await prisma.socialAccount.update({
      where: { id: existing.id },
      data: { accountName: pageName, accessToken, isConnected: true, subscribedToLeads: true },
    })
  } else {
    await prisma.socialAccount.create({
      data: { platform: "FACEBOOK", pageId, accountName: pageName, accessToken, isConnected: true, subscribedToLeads: true },
    })
  }

  return NextResponse.json({ success: true })
}
