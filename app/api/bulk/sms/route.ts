export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { contactIds, message } = await req.json()
    if (!contactIds?.length) return NextResponse.json({ error: "No contacts selected" }, { status: 400 })
    if (!message?.trim()) return NextResponse.json({ error: "Message is required" }, { status: 400 })

    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds } },
      select: { id: true, firstName: true, lastName: true, phone: true },
    })

    const results = await Promise.allSettled(
      contacts.map(contact =>
        prisma.activity.create({
          data: {
            type: "SMS",
            title: `Bulk SMS to ${contact.firstName} ${contact.lastName}`,
            description: message,
            contactId: contact.id,
            userId: session?.user?.id as string,
          },
        })
      )
    )

    const sent = results.filter(r => r.status === "fulfilled").length
    const failed = results.filter(r => r.status === "rejected").length

    return NextResponse.json({ success: true, sent, failed, total: contacts.length })
  } catch (e) {
    console.error("Bulk SMS error:", e)
    return NextResponse.json({ error: "Failed to send bulk SMS" }, { status: 500 })
  }
}
