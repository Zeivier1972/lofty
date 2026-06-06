export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  const accounts = await prisma.socialAccount.findMany({
    orderBy: { platform: "asc" },
  })
  return NextResponse.json(accounts)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { platform, accountName, accessToken, pageId } = await req.json()

  const existing = await prisma.socialAccount.findFirst({ where: { platform } })
  const account = existing
    ? await prisma.socialAccount.update({
        where: { id: existing.id },
        data: { accountName, accessToken, pageId, isConnected: true },
      })
    : await prisma.socialAccount.create({
        data: { platform, accountName, accessToken, pageId, isConnected: true },
      })

  return NextResponse.json(account)
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { platform } = await req.json()
  const account = await prisma.socialAccount.findFirst({ where: { platform } })
  if (account) {
    await prisma.socialAccount.update({
      where: { id: account.id },
      data: { isConnected: false, accessToken: null },
    })
  }
  return NextResponse.json({ success: true })
}
