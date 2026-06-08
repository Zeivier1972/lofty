export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { scoreContact } from "@/lib/scoring"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { contactId } = await req.json()
  if (!contactId) return NextResponse.json({ error: "contactId required" }, { status: 400 })

  const score = await scoreContact(contactId)
  return NextResponse.json({ score })
}

// GET: recalculate all contacts (admin use)
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const contacts = await prisma.contact.findMany({
    where: { isArchived: false },
    select: { id: true },
    take: 100,
  })

  const results = await Promise.all(contacts.map(c => scoreContact(c.id)))
  return NextResponse.json({ updated: results.length })
}
