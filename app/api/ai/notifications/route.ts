export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const unreadOnly = searchParams.get("unread") === "true"

  const notifications = await prisma.aINotification.findMany({
    where: unreadOnly ? { isRead: false } : {},
    include: { contact: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return NextResponse.json(notifications)
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { ids, markAll } = await req.json()

  if (markAll) {
    await prisma.aINotification.updateMany({ data: { isRead: true } })
  } else if (ids?.length) {
    await prisma.aINotification.updateMany({ where: { id: { in: ids } }, data: { isRead: true } })
  }

  return NextResponse.json({ success: true })
}
