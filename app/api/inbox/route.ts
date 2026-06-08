export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const channel = searchParams.get("channel") || "all"

  // Get latest SMS per contact
  const smsMessages = channel !== "whatsapp"
    ? await prisma.sMSMessage.findMany({
        where: { contactId: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 500,
      })
    : []

  // Get latest WhatsApp per contact
  const waMessages = channel !== "sms"
    ? await prisma.whatsAppMessage.findMany({
        where: { contactId: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 500,
      })
    : []

  // Build map of contactId → latest message
  const threadMap = new Map<string, any>()

  for (const msg of smsMessages) {
    if (!msg.contactId) continue
    if (!threadMap.has(msg.contactId)) {
      threadMap.set(msg.contactId, {
        contactId: msg.contactId,
        lastMessage: msg.body,
        lastMessageAt: msg.createdAt,
        lastDirection: msg.direction,
        channel: "sms",
        unread: msg.direction === "INBOUND",
      })
    }
  }

  for (const msg of waMessages) {
    if (!msg.contactId) continue
    const existing = threadMap.get(msg.contactId)
    if (!existing) {
      threadMap.set(msg.contactId, {
        contactId: msg.contactId,
        lastMessage: msg.body,
        lastMessageAt: msg.createdAt,
        lastDirection: msg.direction,
        channel: "whatsapp",
        unread: msg.direction === "INBOUND",
      })
    } else if (msg.createdAt > existing.lastMessageAt) {
      existing.lastMessage = msg.body
      existing.lastMessageAt = msg.createdAt
      existing.lastDirection = msg.direction
      existing.channel = "whatsapp"
    }
  }

  // Fetch contacts for all thread IDs
  const contactIds = Array.from(threadMap.keys())
  const contacts = contactIds.length > 0
    ? await prisma.contact.findMany({
        where: { id: { in: contactIds } },
        select: { id: true, firstName: true, lastName: true, phone: true, leadScore: true },
      })
    : []

  const contactMap = new Map(contacts.map(c => [c.id, c]))

  const threads = Array.from(threadMap.values())
    .map(t => ({ ...t, contact: contactMap.get(t.contactId) }))
    .filter(t => t.contact)
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())

  const unreadSms = smsMessages.filter(m => m.direction === "INBOUND").length
  const unreadWa = waMessages.filter(m => m.direction === "INBOUND").length

  return NextResponse.json({ threads, unreadSms, unreadWa })
}
