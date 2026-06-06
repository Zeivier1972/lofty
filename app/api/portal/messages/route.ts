import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getPortalSession } from "@/lib/portal-auth"
import { chatWithAI } from "@/lib/ai-agent"

export async function GET() {
  const session = await getPortalSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const messages = await prisma.portalMessage.findMany({
    where: { contactId: session.contactId },
    orderBy: { createdAt: "asc" },
  })
  return NextResponse.json(messages)
}

export async function POST(req: Request) {
  const session = await getPortalSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: "Content required" }, { status: 400 })

  const contact = await prisma.contact.findUnique({ where: { id: session.contactId } })
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Save client message
  const message = await prisma.portalMessage.create({
    data: { contactId: session.contactId, fromClient: true, content: content.trim(), isRead: false },
  })

  // Get conversation history for context
  const history = await prisma.portalMessage.findMany({
    where: { contactId: session.contactId },
    orderBy: { createdAt: "asc" },
    take: 10,
  })

  const aiMessages = history.map(m => ({
    role: m.fromClient ? "user" : "assistant" as "user" | "assistant",
    content: m.content,
  }))

  const contactCtx = `Client portal user: ${contact.firstName} ${contact.lastName}. Status: ${contact.status}. Lead Score: ${contact.leadScore}. Communicate via portal chat.`
  const aiReply = await chatWithAI(aiMessages, contactCtx)

  const reply = await prisma.portalMessage.create({
    data: { contactId: session.contactId, fromClient: false, content: aiReply, isRead: false },
  })

  // Notify agent
  await prisma.aINotification.create({
    data: {
      type: "PORTAL_MESSAGE",
      title: `Portal message from ${contact.firstName} ${contact.lastName}`,
      body: content.slice(0, 120),
      priority: "HIGH",
      contactId: session.contactId,
    },
  })

  await prisma.activity.create({
    data: {
      type: "PORTAL_MESSAGE",
      title: "Client sent portal message",
      description: content.slice(0, 100),
      contactId: session.contactId,
    },
  })

  return NextResponse.json({ message, reply })
}
