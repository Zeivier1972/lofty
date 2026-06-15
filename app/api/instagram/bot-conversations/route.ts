import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const conversations = await prisma.instagramConversation.findMany({
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: {
      id: true,
      igUserId: true,
      igUsername: true,
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
  const { igUserId } = await req.json()
  if (!igUserId) return NextResponse.json({ error: "igUserId required" }, { status: 400 })
  await prisma.instagramConversation.delete({ where: { igUserId } })
  return NextResponse.json({ ok: true })
}
