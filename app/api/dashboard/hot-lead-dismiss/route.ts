export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// Remove (or restore) a lead from the Dashboard "Leads Calientes" widget once
// the agent has spoken to them. Uses a dedicated marker so it doesn't disturb
// lastContacted or the AI Agent list.
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { contactId, undo } = await req.json()
  if (!contactId) return NextResponse.json({ error: "contactId required" }, { status: 400 })

  await prisma.contact.update({
    where: { id: contactId },
    data: { hotLeadDismissedAt: undo ? null : new Date() },
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
