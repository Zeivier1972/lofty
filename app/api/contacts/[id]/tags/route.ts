export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// POST — add a tag to a contact
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { tagId } = await req.json()
  if (!tagId) return NextResponse.json({ error: "tagId required" }, { status: 400 })

  await prisma.contactTag.upsert({
    where: { contactId_tagId: { contactId: params.id, tagId } },
    create: { contactId: params.id, tagId },
    update: {},
  })

  return NextResponse.json({ success: true })
}

// DELETE — remove a tag from a contact
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { tagId } = await req.json()
  if (!tagId) return NextResponse.json({ error: "tagId required" }, { status: 400 })

  await prisma.contactTag.deleteMany({
    where: { contactId: params.id, tagId },
  })

  return NextResponse.json({ success: true })
}
