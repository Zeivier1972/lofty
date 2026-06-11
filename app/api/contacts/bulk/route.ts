export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

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
