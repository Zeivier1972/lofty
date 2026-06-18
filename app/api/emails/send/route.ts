export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendEmail, wrapEmail } from "@/lib/email"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { to, subject, body, contactId, templateId } = await req.json()
  if (!to?.trim() || !subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "to, subject, and body are required" }, { status: 400 })
  }

  // Resolve contact if only ID given
  let resolvedContact: { id: string; firstName: string; lastName: string | null; email: string | null } | null = null
  if (contactId) {
    resolvedContact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { id: true, firstName: true, lastName: true, email: true },
    })
  }

  const toEmail = resolvedContact?.email || to.trim()

  // Send via Resend / SMTP
  let status = "SENT"
  try {
    await sendEmail({ to: toEmail, subject: subject.trim(), html: wrapEmail(body.trim(), { agentName: "Catherine Gómez", preheader: subject.trim() }) })
  } catch (e: any) {
    console.error("[emails/send]", e?.message)
    status = "FAILED"
  }

  // Log email record
  const email = await prisma.email.create({
    data: {
      subject:     subject.trim(),
      body:        body.trim(),
      fromAddress: process.env.RESEND_FROM || process.env.SMTP_FROM || "CRM <noreply@casaicrm.com>",
      toAddress:   toEmail,
      status,
      contactId:   resolvedContact?.id || null,
      templateId:  templateId || null,
      sentAt:      status === "SENT" ? new Date() : null,
    },
  })

  // Activity log
  if (resolvedContact?.id) {
    await prisma.activity.create({
      data: {
        type:        "EMAIL_SENT",
        title:       `Email enviado: ${subject.trim()}`,
        description: body.trim().slice(0, 120),
        contactId:   resolvedContact.id,
      },
    }).catch(() => {})
  }

  if (status === "FAILED") {
    return NextResponse.json({ error: "Email provider not configured — check RESEND_API_KEY / SMTP env vars", email }, { status: 500 })
  }

  return NextResponse.json({ email }, { status: 201 })
}
