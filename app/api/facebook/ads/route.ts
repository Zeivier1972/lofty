export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createFacebookAdCampaign } from "@/lib/facebook"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const {
    campaignName, objective, primaryText, headline, description,
    imageUrl, destinationUrl, ctaType, dailyBudgetCents,
    startTime, endTime, targetLocations, ageMin, ageMax,
  } = body

  if (!campaignName || !primaryText || !headline || !destinationUrl) {
    return NextResponse.json({ error: "campaignName, primaryText, headline and destinationUrl are required" }, { status: 400 })
  }

  try {
    const result = await createFacebookAdCampaign({
      campaignName,
      objective: objective || "OUTCOME_LEADS",
      primaryText,
      headline,
      description: description || "",
      imageUrl: imageUrl || "",
      destinationUrl,
      ctaType: ctaType || "LEARN_MORE",
      dailyBudgetCents: dailyBudgetCents || 1000,
      startTime: startTime || new Date().toISOString(),
      endTime: endTime || undefined,
      targetLocations: targetLocations || ["Miami, Florida"],
      ageMin: ageMin || 25,
      ageMax: ageMax || 65,
    })

    // Store in MarketingCampaign for the history view
    await prisma.marketingCampaign.create({
      data: {
        name: campaignName,
        type: "FACEBOOK",
        status: "SENT",
        subject: headline,
        content: primaryText,
        sentAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, ...result })
  } catch (e: any) {
    console.error("[Facebook Ads]", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
