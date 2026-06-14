export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET — Catherine reads the portal thread for a contact
export async function GET(_req: Request, { params }: { params: { contactId: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const messages = await prisma.portalMessage.findMany({
    where: { contactId: params.contactId },
    orderBy: { createdAt: "asc" },
  })

  // Mark all client messages as read
  await prisma.portalMessage.updateMany({
    where: { contactId: params.contactId, fromClient: true, isRead: false },
    data: { isRead: true },
  })

  return NextResponse.json({ messages })
}

// POST — Catherine sends a reply in the portal (appears as agent message)
export async function POST(req: Request, { params }: { params: { contactId: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 })

  const message = await prisma.portalMessage.create({
    data: {
      contactId: params.contactId,
      fromClient: false,
      content: content.trim(),
      isRead: false,
    },
  })

  await prisma.activity.create({
    data: {
      type: "PORTAL_MESSAGE",
      title: "Mensaje enviado via portal",
      description: content.trim().slice(0, 100),
      contactId: params.contactId,
    },
  }).catch(() => {})

  return NextResponse.json({ message })
}
