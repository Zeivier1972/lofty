export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET: session status + progress
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await prisma.powerDialSession.findUnique({ where: { id: params.id } })
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const queue: any[] = JSON.parse(session.contactQueue)
    const callLog: any[] = JSON.parse(session.callLog)
    const current = queue[session.currentIndex] ?? null

    return NextResponse.json({
      id: session.id,
      status: session.status,
      currentIndex: session.currentIndex,
      totalCount: session.totalCount,
      currentContact: current,
      callLog,
      completedCount: callLog.length,
    })
  } catch (e) {
    return NextResponse.json({ error: "Failed to get session" }, { status: 500 })
  }
}

// DELETE: stop session
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.powerDialSession.update({
      where: { id: params.id },
      data: { status: "STOPPED" },
    })
    return NextResponse.json({ stopped: true })
  } catch (e) {
    return NextResponse.json({ error: "Failed to stop session" }, { status: 500 })
  }
}
