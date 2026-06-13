export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const calls = await prisma.dialerCall.findMany({
    where: { contactId: params.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      status: true,
      direction: true,
      duration: true,
      recordingUrl: true,
      transcription: true,
      aiSummary: true,
      notes: true,
      disposition: true,
      startedAt: true,
      endedAt: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ calls })
}
