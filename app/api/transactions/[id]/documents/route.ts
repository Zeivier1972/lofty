export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// POST — attach a document by URL (Google Drive, Dropbox, OneDrive, etc.)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name, url, fileType } = await req.json()
  if (!name?.trim() || !url?.trim()) {
    return NextResponse.json({ error: "Nombre y URL requeridos" }, { status: 400 })
  }

  const doc = await prisma.transactionDocument.create({
    data: {
      transactionId: params.id,
      name: name.trim(),
      url: url.trim(),
      fileType: fileType || "link",
    },
  })
  return NextResponse.json({ doc })
}
