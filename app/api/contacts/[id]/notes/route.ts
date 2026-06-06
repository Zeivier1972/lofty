export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { content, isPinned } = await req.json()

    const note = await prisma.note.create({
      data: {
        content,
        isPinned: isPinned || false,
        contactId: params.id,
        authorId: session?.user?.id,
      },
      include: { author: { select: { name: true } } },
    })

    await prisma.activity.create({
      data: {
        type: "NOTE_ADDED",
        title: "Note added",
        contactId: params.id,
        userId: session?.user?.id,
      },
    })

    return NextResponse.json(note, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Failed to add note" }, { status: 500 })
  }
}
