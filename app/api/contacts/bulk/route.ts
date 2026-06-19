export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// POST: apply a tag to multiple contacts
// body: { ids: string[], tagId: string }
export async function POST(req: Request) {
  try {
    const { ids, tagId } = await req.json()
    if (!ids?.length || !tagId) return NextResponse.json({ error: "ids and tagId required" }, { status: 400 })

    // upsert to avoid duplicates
    await Promise.all(
      ids.map((contactId: string) =>
        prisma.contactTag.upsert({
          where: { contactId_tagId: { contactId, tagId } },
          update: {},
          create: { contactId, tagId },
        })
      )
    )
    return NextResponse.json({ tagged: ids.length })
  } catch (e) {
    console.error("Bulk tag error:", e)
    return NextResponse.json({ error: "Failed to apply tag" }, { status: 500 })
  }
}

// DELETE: permanently delete multiple contacts
// body: { ids: string[] }
export async function DELETE(req: Request) {
  try {
    const { ids } = await req.json()
    if (!ids?.length) return NextResponse.json({ error: "ids required" }, { status: 400 })

    await prisma.contact.deleteMany({ where: { id: { in: ids } } })
    return NextResponse.json({ deleted: ids.length })
  } catch (e) {
    console.error("Bulk contact delete error:", e)
    return NextResponse.json({ error: "Failed to delete contacts" }, { status: 500 })
  }
}
