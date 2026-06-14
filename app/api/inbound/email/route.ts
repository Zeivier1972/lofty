export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Resend inbound email webhook (event type: email.received)
// Resend wraps the payload as { type: "email.received", data: { email: {...} } }
// but also supports flat format — handle both.
export async function POST(req: Request) {
  try {
    const payload = await req.json()

    // Unwrap Resend's event envelope if present
    const email = payload.data?.email ?? payload
    console.log("[Inbound email] received from:", email.from, "type:", payload.type)

    // Resend sends either a string or array for `to`
    const fromRaw: string = Array.isArray(email.from) ? email.from[0] : (email.from || "")
    const subject: string = email.subject || "(sin asunto)"
    const body: string = email.text || email.plain_text || email.html || ""

    // Extract sender email address — handle "Name <email@example.com>" format
    const fromMatch = fromRaw.match(/<([^>]+)>/) || fromRaw.match(/([^\s]+@[^\s]+)/)
    const fromEmail = fromMatch ? fromMatch[1].toLowerCase().trim() : fromRaw.toLowerCase().trim()

    if (!fromEmail) {
      console.warn("[Inbound email] Could not parse sender email from:", fromRaw)
      return NextResponse.json({ ok: true })
    }

    // Find the contact by email address
    const contact = await prisma.contact.findFirst({
      where: { email: { equals: fromEmail, mode: "insensitive" } } as any,
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
