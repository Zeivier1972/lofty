export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// Lightweight lead history for the auto-dialer: recent notes, activity timeline,
// and any partner referrals (so the agent sees who the lead belongs to and the
// prior conversation before making the call).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [notes, activities, referrals] = await Promise.all([
    prisma.note.findMany({
      where: { contactId: params.id },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      take: 15,
      select: { id: true, content: true, createdAt: true, isPinned: true, author: { select: { name: true } } },
    }),
    prisma.activity.findMany({
      where: { contactId: params.id },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { id: true, type: true, title: true, description: true, createdAt: true },
    }),
    prisma.leadReferral.findMany({
      where: { contactId: params.id },
      orderBy: { sentAt: "desc" },
      take: 3,
      select: { status: true, sentAt: true, partner: { select: { name: true } } },
    }).catch(() => []),
  ])

  return NextResponse.json({ notes, activities, referrals })
}
