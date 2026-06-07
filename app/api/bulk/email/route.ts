export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { sendBulkEmail, wrapEmail } from "@/lib/email"

function buildUnsubscribeUrl(contactId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://localhost:3000"
  return `${base}/api/unsubscribe?id=${contactId}`
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { contactIds, subject, body, campaignId } = await req.json()
    if (!contactIds?.length) return NextResponse.json({ error: "No contacts selected" }, { status: 400 })
    if (!subject?.trim()) return NextResponse.json({ error: "Subject is required" }, { status: 400 })
    if (!body?.trim()) return NextResponse.json({ error: "Body is required" }, { status: 400 })

    // Fetch contacts who haven't opted out
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: contactIds },
        email: { not: null },
        doNotEmail: false,
      },
      select: { id: true, firstName: true, lastName: true, email: true },
    })

    const skipped = contactIds.length - contacts.length

    // Get agent name for footer
    const aiConfig = await prisma.aIConfig.findFirst()
    const agentName = aiConfig?.realtorName || "Catherine"

    // Build recipient list with personalization vars
    const recipients = contacts.map(c => ({
      to: c.email!,
      vars: {
        first_name: c.firstName,
        last_name: c.lastName,
        full_name: `${c.firstName} ${c.lastName}`,
        unsubscribe_url: buildUnsubscribeUrl(c.id),
      },
    }))

    // Wrap body with unsubscribe footer
    const wrappedHtml = wrapEmail(
      body
        .replace(/\{first_name\}/gi, "{first_name}")
        .replace(/\{last_name\}/gi, "{last_name}"),
      {
        agentName,
        unsubscribeUrl: "{unsubscribe_url}",
      }
    )

    // Send in batches of 50, 1 second between batches
    const { sent, failed } = await sendBulkEmail(recipients, {
      subject,
      html: wrappedHtml,
    }, 50, 1000)

    // Log activities for sent emails
    await prisma.activity.createMany({
      data: contacts.slice(0, sent).map(c => ({
        type: "EMAIL",
        title: subject,
        description: `Bulk email: ${subject}`,
        contactId: c.id,
        userId: session.user?.id as string,
      })),
      skipDuplicates: true,
    })

    // Update campaign stats if this is tied to a campaign
    if (campaignId) {
      await prisma.marketingCampaign.update({
        where: { id: campaignId },
        data: {
          status: "SENT",
          sentAt: new Date(),
          recipients: sent,
        },
      })
    }

    return NextResponse.json({ success: true, sent, failed, skipped, total: contacts.length })
  } catch (e) {
    console.error("Bulk email error:", e)
    return NextResponse.json({ error: "Failed to send bulk email" }, { status: 500 })
  }
}
