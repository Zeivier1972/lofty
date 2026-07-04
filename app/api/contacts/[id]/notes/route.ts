export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { extractBuyerPrefsFromNote, triggerMatchAlert } from "@/lib/trigger-match-alert"

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

    // Fire-and-forget: extract buyer prefs from note text and update contact profile
    ;(async () => {
      try {
        const prefs = await extractBuyerPrefsFromNote(content)
        if (!prefs || Object.keys(prefs).length === 0) return

        const hasPrefs = prefs.buyerBudgetMax || prefs.buyerLocation || prefs.buyerBedroomsMin

        await prisma.contact.update({
          where: { id: params.id },
          data: {
            ...prefs,
            // Set matchPrefsCompletedAt only if we extracted useful prefs and it wasn't already set
            ...(hasPrefs ? {
              matchPrefsCompletedAt: await prisma.contact.findUnique({
                where: { id: params.id },
                select: { matchPrefsCompletedAt: true },
              }).then(c => c?.matchPrefsCompletedAt ?? new Date()),
            } : {}),
          },
        })

        // Send immediate match alert if we found new prefs
        if (hasPrefs) {
          await triggerMatchAlert(params.id)
        }
      } catch (e) {
        console.error("[note-prefs-extract]", e)
      }
    })()

    return NextResponse.json(note, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Failed to add note" }, { status: 500 })
  }
}
