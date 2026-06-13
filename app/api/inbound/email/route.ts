export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Resend inbound email webhook
// Receives replies from contacts and stores them against the matching contact.
export async function POST(req: Request) {
  try {
    const payload = await req.json()
    console.log("[Inbound email] received from:", payload.from)

    // Resend sends either a string or array for `to`
    const fromRaw: string = Array.isArray(payload.from) ? payload.from[0] : (payload.from || "")
    const subject: string = payload.subject || "(sin asunto)"
    const body: string = payload.text || payload.plain_text || payload.html || ""

    // Extract sender email address — handle "Name <email@example.com>" format
    const fromMatch = fromRaw.match(/<([^>]+)>/) || fromRaw.match(/([^\s]+@[^\s]+)/)
    const fromEmail = fromMatch ? fromMatch[1].toLowerCase().trim() : fromRaw.toLowerCase().trim()

    if (!fromEmail) {
      console.warn("[Inbound email] Could not parse sender email from:", fromRaw)
      return NextResponse.json({ ok: true })
    }

    // Find the contact by email address
    const contact = await prisma.contact.findFirst({
      where: { email: { equals: fromEmail, mode: "insensitive" } },
      select: { id: true, firstName: true, lastName: true },
    })

    const inboundEmail = await prisma.email.create({
      data: {
        subject,
        body: body.slice(0, 10000),
        fromAddress: fromEmail,
        toAddress: process.env.RESEND_FROM || "reply@inbound.catherinegomezrealtor.com",
        direction: "INBOUND",
        status: "RECEIVED",
        contactId: contact?.id || null,
        sentAt: new Date(),
      },
    })

    if (contact) {
      await prisma.activity.create({
        data: {
          type: "EMAIL",
          title: `Email recibido: ${subject}`,
          description: body.slice(0, 200),
          contactId: contact.id,
        },
      })
      console.log(`[Inbound email] matched to contact ${contact.id} (${contact.firstName})`)
    } else {
      console.warn(`[Inbound email] No contact found for email: ${fromEmail}`)
    }

    return NextResponse.json({ ok: true, emailId: inboundEmail.id })
  } catch (e: any) {
    console.error("[Inbound email] Error:", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
