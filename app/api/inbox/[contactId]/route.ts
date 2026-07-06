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
    select: { id: true, firstName: true, lastName: true, phone: true, email: true, leadScore: true, status: true, facebookPsid: true },
  })
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [smsMessages, waMessages, fbMessages] = await Promise.all([
    prisma.sMSMessage.findMany({ where: { contactId }, orderBy: { createdAt: "asc" }, take: 200 }),
    prisma.whatsAppMessage.findMany({ where: { contactId }, orderBy: { createdAt: "asc" }, take: 200 }),
    prisma.facebookMessage.findMany({ where: { contactId }, orderBy: { createdAt: "asc" }, take: 200 }),
  ])

  const messages = [
    ...smsMessages.map(m => ({ ...m, channel: "sms" })),
    ...waMessages.map(m => ({ ...m, channel: "whatsapp" })),
    ...fbMessages.map(m => ({ ...m, channel: "facebook" })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  // Opening the conversation marks its inbound messages as read
  await Promise.all([
    prisma.sMSMessage.updateMany({ where: { contactId, direction: "INBOUND", isRead: false }, data: { isRead: true } }),
    prisma.whatsAppMessage.updateMany({ where: { contactId, direction: "INBOUND", isRead: false }, data: { isRead: true } }),
    prisma.facebookMessage.updateMany({ where: { contactId, direction: "INBOUND", isRead: false }, data: { isRead: true } }),
    prisma.portalMessage.updateMany({ where: { contactId, fromClient: true, isRead: false }, data: { isRead: true } }),
  ]).catch(() => {})

  return NextResponse.json({ contact, messages })
}
