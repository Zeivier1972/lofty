import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const conversations = await prisma.facebookBotConversation.findMany({
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: {
      id: true,
      psid: true,
      state: true,
      firstName: true,
      email: true,
      phone: true,
      intent: true,
      campaignKeyword: true,
      contactId: true,
      updatedAt: true,
    },
  })
  return NextResponse.json(conversations)
}

export async function DELETE(req: Request) {
  const { psid } = await req.json()
  if (!psid) return NextResponse.json({ error: "psid required" }, { status: 400 })
  await prisma.facebookBotConversation.delete({ where: { psid } })
  return NextResponse.json({ ok: true })
}
