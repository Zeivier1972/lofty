import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { chatWithAI } from "@/lib/ai-agent"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { messages, contactId } = await req.json()

  let contactContext = ""
  if (contactId) {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        tags: { include: { tag: true } },
        notes: { take: 3, orderBy: { createdAt: "desc" } },
      },
    })
    if (contact) {
      contactContext = `
Contact: ${contact.firstName} ${contact.lastName}
Status: ${contact.status}
Lead Score: ${contact.leadScore}
Email: ${contact.email || "N/A"}
Phone: ${contact.phone || "N/A"}
Budget: ${contact.buyerBudgetMin ? `$${contact.buyerBudgetMin.toLocaleString()} - $${contact.buyerBudgetMax?.toLocaleString()}` : "not set"}
Tags: ${contact.tags.map((t) => t.tag.name).join(", ") || "none"}
Recent notes: ${contact.notes.map((n) => n.content).join("; ") || "none"}`
    }
  }

  try {
    const reply = await chatWithAI(messages, contactContext)
    return NextResponse.json({ reply })
  } catch (error) {
    return NextResponse.json({ error: "AI unavailable" }, { status: 500 })
  }
}
