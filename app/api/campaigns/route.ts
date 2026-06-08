export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { sendBulkEmail, wrapEmail } from "@/lib/email"

function buildAudienceWhere(audience: string, tagIds: string[]) {
  const base: any = { isArchived: false, doNotEmail: false, email: { not: null } }
  const now = new Date()

  if (audience === "buyers") {
    base.OR = [{ buyerBudgetMax: { not: null } }, { buyerLocation: { not: null } }]
  } else if (audience === "sellers") {
    base.OR = [{ sellerAddress: { not: null } }, { sellerEstimatedValue: { not: null } }]
  } else if (audience === "new_leads") {
    base.createdAt = { gte: new Date(now.getTime() - 30 * 24 * 3600000) }
  } else if (audience === "cold") {
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 3600000)
    base.OR = [
      { lastContacted: { lte: sixtyDaysAgo } },
      { lastContacted: null },
    ]
    base.createdAt = { lte: new Date(now.getTime() - 30 * 24 * 3600000) }
  } else if (audience === "no_plan") {
    base.enrollments = { none: { status: "ACTIVE" } }
  }

  if (tagIds?.length > 0) {
    base.tags = { some: { tagId: { in: tagIds } } }
  }

  return base
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const campaigns = await prisma.marketingCampaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  })
  return NextResponse.json(campaigns)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { name, subject, subjectVariantB, body, audience = "all", tagIds = [], sendNow = false } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 })

    const campaign = await prisma.marketingCampaign.create({
      data: {
        name,
        subject,
        subjectVariantB: subjectVariantB || null,
        content: body,
        type: "EMAIL",
        status: sendNow ? "SENDING" : "DRAFT",
        audience,
        tagIds: Array.isArray(tagIds) ? tagIds.join(",") : tagIds,
      },
    })

    if (!sendNow) return NextResponse.json(campaign)

    // Fetch audience
    const where = buildAudienceWhere(audience, tagIds)
    const contacts = await prisma.contact.findMany({
      where,
      select: { id: true, firstName: true, lastName: true, email: true },
    })

    const aiConfig = await prisma.aIConfig.findFirst()
    const agentName = aiConfig?.realtorName || "Catherine"
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://localhost:3000"

    // A/B split: if subjectVariantB provided, split recipients 50/50
    const useAB = !!subjectVariantB
    const midpoint = Math.floor(contacts.length / 2)

    const recipients = contacts.map((c, i) => ({
      to: c.email!,
      vars: {
        first_name: c.firstName,
        last_name: c.lastName,
        full_name: `${c.firstName} ${c.lastName}`,
        unsubscribe_url: `${baseUrl}/api/unsubscribe?id=${c.id}`,
        _ab_variant: useAB && i >= midpoint ? "B" : "A",
      },
    }))

    const wrappedHtml = wrapEmail(body, {
      agentName,
      unsubscribeUrl: "{unsubscribe_url}",
    })

    // Send A and B with different subjects
    let sent = 0
    let failed = 0
    if (useAB) {
      const recipientsA = recipients.filter(r => r.vars._ab_variant === "A")
      const recipientsB = recipients.filter(r => r.vars._ab_variant === "B")
      const [resultA, resultB] = await Promise.all([
        sendBulkEmail(recipientsA, { subject, html: wrappedHtml }, 50, 1000),
        sendBulkEmail(recipientsB, { subject: subjectVariantB, html: wrappedHtml }, 50, 1000),
      ])
      sent = resultA.sent + resultB.sent
      failed = resultA.failed + resultB.failed
    } else {
      const result = await sendBulkEmail(recipients, { subject, html: wrappedHtml }, 50, 1000)
      sent = result.sent
      failed = result.failed
    }

    // Update campaign stats
    await prisma.marketingCampaign.update({
      where: { id: campaign.id },
      data: { status: "SENT", sentAt: new Date(), recipients: sent },
    })

    // Log activities
    if (sent > 0) {
      await prisma.activity.createMany({
        data: contacts.slice(0, sent).map(c => ({
          type: "EMAIL",
          title: subject || name,
          description: `Campaña: ${name}`,
          contactId: c.id,
          userId: session.user?.id as string,
        })),
        skipDuplicates: true,
      })
    }

    return NextResponse.json({ ...campaign, sent, failed, total: contacts.length })
  } catch (e) {
    console.error("Campaign error:", e)
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 })
  }
}
