export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const accounts = await prisma.socialAccount.findMany({
    where: { platform: "FACEBOOK", isConnected: true },
    select: { id: true, accountName: true, pageId: true, subscribedToLeads: true, createdAt: true },
  })

  const result = await Promise.all(
    accounts.map(async (account) => {
      let forms: any[] = []
      if (account.pageId) {
        const token = await getPageToken(account.pageId)
        if (token) {
          try {
            const res = await fetch(
              `https://graph.facebook.com/v18.0/${account.pageId}/leadgen_forms?` +
              `fields=id,name,status,leads_count&access_token=${token}&limit=50`
            )
            const data = await res.json()
            forms = data.data || []
          } catch {}
        }
      }
      return { ...account, forms }
    })
  )

  return NextResponse.json({ accounts: result })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const pageId = searchParams.get("pageId")

  if (pageId) {
    const account = await prisma.socialAccount.findFirst({
      where: { platform: "FACEBOOK", pageId },
    })
    if (account?.accessToken) {
      try {
        await fetch(
          `https://graph.facebook.com/v18.0/${pageId}/subscribed_apps?access_token=${account.accessToken}`,
          { method: "DELETE" }
        )
      } catch {}
    }
    await prisma.socialAccount.updateMany({
      where: { platform: "FACEBOOK", pageId },
      data: { isConnected: false, subscribedToLeads: false, accessToken: null },
    })
  } else {
    const accounts = await prisma.socialAccount.findMany({
      where: { platform: "FACEBOOK", isConnected: true },
    })
    for (const acc of accounts) {
      if (acc.accessToken && acc.pageId) {
        try {
          await fetch(
            `https://graph.facebook.com/v18.0/${acc.pageId}/subscribed_apps?access_token=${acc.accessToken}`,
            { method: "DELETE" }
          )
        } catch {}
      }
    }
    await prisma.socialAccount.updateMany({
      where: { platform: "FACEBOOK" },
      data: { isConnected: false, subscribedToLeads: false, accessToken: null },
    })
  }

  return NextResponse.json({ success: true })
}

async function getPageToken(pageId: string): Promise<string | null> {
  const account = await prisma.socialAccount.findFirst({
    where: { platform: "FACEBOOK", pageId, isConnected: true },
    select: { accessToken: true },
  })
  return account?.accessToken || process.env.FB_PAGE_ACCESS_TOKEN || null
}
