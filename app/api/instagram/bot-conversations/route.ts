import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// Dashboard-only: these return lead names, emails and phones, and DELETE
// removes conversations. Both were reachable without a session.
const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 })

export async function GET() {
  if (!(await auth())) return unauthorized()
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
  if (!(await auth())) return unauthorized()
  const { igUserId } = await req.json()
  if (!igUserId) return NextResponse.json({ error: "igUserId required" }, { status: 400 })
  await prisma.instagramConversation.delete({ where: { igUserId } })
  return NextResponse.json({ ok: true })
}
