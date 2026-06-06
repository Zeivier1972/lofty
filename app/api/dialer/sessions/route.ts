export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const sessions = await prisma.dialerSession.findMany({
    where: { agentId: session.user!.id as string },
    include: {
      calls: {
        include: { contact: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  })

  return NextResponse.json(sessions)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const name: string = body.name || "Dial Session"

  const dialerSession = await prisma.dialerSession.create({
    data: { name, agentId: session.user!.id as string },
  })

  return NextResponse.json(dialerSession, { status: 201 })
}
