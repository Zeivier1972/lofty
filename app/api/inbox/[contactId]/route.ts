export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(req: Request, { params }: { params: { contactId: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { contactId } = params

  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { id: true, firstName: true, lastName: true, phone: true, email: true, leadScore: true, status: true },
  })
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [smsMessages, waMessages] = await Promise.all([
    prisma.sMSMessage.findMany({
      where: { contactId },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
    prisma.whatsAppMessage.findMany({
      where: { contactId },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
  ])

  // Merge and sort by time
  const messages = [
    ...smsMessages.map(m => ({ ...m, channel: "sms" })),
    ...waMessages.map(m => ({ ...m, channel: "whatsapp" })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  return NextResponse.json({ contact, messages })
}
