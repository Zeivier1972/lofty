export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const channel = searchParams.get("channel") || "all"

  const [smsMessages, waMessages, fbMessages, portalMessages] = await Promise.all([
    channel !== "whatsapp" && channel !== "facebook" && channel !== "portal"
      ? prisma.sMSMessage.findMany({ where: { contactId: { not: null } }, orderBy: { createdAt: "desc" }, take: 500 })
      : [],
    channel !== "sms" && channel !== "facebook" && channel !== "portal"
      ? prisma.whatsAppMessage.findMany({ where: { contactId: { not: null } }, orderBy: { createdAt: "desc" }, take: 500 })
      : [],
    channel !== "sms" && channel !== "whatsapp" && channel !== "portal"
      ? prisma.facebookMessage.findMany({ where: { contactId: { not: null } }, orderBy: { createdAt: "desc" }, take: 500 })
      : [],
    channel !== "sms" && channel !== "whatsapp" && channel !== "facebook"
      ? prisma.portalMessage.findMany({ where: { fromClient: true }, orderBy: { createdAt: "desc" }, take: 500 })
      : [],
  ])

  const threadMap = new Map<string, any>()

  for (const msg of smsMessages as any[]) {
    if (!msg.contactId) continue
    if (!threadMap.has(msg.contactId)) {
      threadMap.set(msg.contactId, {
        contactId: msg.contactId, lastMessage: msg.body, lastMessageAt: msg.createdAt,
        lastDirection: msg.direction, channel: "sms", unread: msg.direction === "INBOUND",
      })
    }
  }

  for (const msg of waMessages as any[]) {
    if (!msg.contactId) continue
    const existing = threadMap.get(msg.contactId)
    if (!existing) {
      threadMap.set(msg.contactId, {
        contactId: msg.contactId, lastMessage: msg.body, lastMessageAt: msg.createdAt,
        lastDirection: msg.direction, channel: "whatsapp", unread: msg.direction === "INBOUND",
      })
    } else if (msg.createdAt > existing.lastMessageAt) {
      Object.assign(existing, { lastMessage: msg.body, lastMessageAt: msg.createdAt, lastDirection: msg.direction, channel: "whatsapp" })
    }
  }

  for (const msg of fbMessages as any[]) {
    if (!msg.contactId) continue
    const existing = threadMap.get(msg.contactId)
    if (!existing) {
      threadMap.set(msg.contactId, {
        contactId: msg.contactId, lastMessage: msg.body, lastMessageAt: msg.createdAt,
        lastDirection: msg.direction, channel: "facebook", unread: msg.direction === "INBOUND",
      })
    } else if (msg.createdAt > existing.lastMessageAt) {
      Object.assign(existing, { lastMessage: msg.body, lastMessageAt: msg.createdAt, lastDirection: msg.direction, channel: "facebook" })
    }
  }

  for (const msg of portalMessages as any[]) {
    if (!msg.contactId) continue
    const existing = threadMap.get(msg.contactId)
    if (!existing) {
      threadMap.set(msg.contactId, {
        contactId: msg.contactId, lastMessage: msg.content, lastMessageAt: msg.createdAt,
        lastDirection: "INBOUND", channel: "portal", unread: !msg.isRead,
      })
    } else if (msg.createdAt > existing.lastMessageAt) {
      Object.assign(existing, { lastMessage: msg.content, lastMessageAt: msg.createdAt, lastDirection: "INBOUND", channel: "portal", unread: !msg.isRead })
    }
  }

  const contactIds = Array.from(threadMap.keys())
  const contacts = contactIds.length > 0
    ? await prisma.contact.findMany({
        where: { id: { in: contactIds } },
        select: { id: true, firstName: true, lastName: true, phone: true, leadScore: true, facebookPsid: true },
      })
    : []

  const contactMap = new Map(contacts.map(c => [c.id, c]))

  const threads = Array.from(threadMap.values())
    .map(t => ({ ...t, contact: contactMap.get(t.contactId) }))
    .filter(t => t.contact)
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())

  const unreadSms = (smsMessages as any[]).filter(m => m.direction === "INBOUND").length
  const unreadWa = (waMessages as any[]).filter(m => m.direction === "INBOUND").length
  const unreadFb = (fbMessages as any[]).filter(m => m.direction === "INBOUND").length
  const unreadPortal = (portalMessages as any[]).filter(m => !m.isRead).length

  return NextResponse.json({ threads, unreadSms, unreadWa, unreadFb, unreadPortal })
}
