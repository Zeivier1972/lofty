export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { contactIds, subject, body } = await req.json()
    if (!contactIds?.length) return NextResponse.json({ error: "No contacts selected" }, { status: 400 })
    if (!subject?.trim()) return NextResponse.json({ error: "Subject is required" }, { status: 400 })
    if (!body?.trim()) return NextResponse.json({ error: "Body is required" }, { status: 400 })

    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    })

    const results = await Promise.allSettled(
      contacts.map(contact =>
        prisma.activity.create({
          data: {
            type: "EMAIL",
            title: subject,
            description: body
              .replace(/\{first_name\}/gi, contact.firstName)
              .replace(/\{last_name\}/gi, contact.lastName),
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
    console.error("Bulk email error:", e)
    return NextResponse.json({ error: "Failed to send bulk email" }, { status: 500 })
  }
}
