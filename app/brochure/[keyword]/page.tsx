export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"

export default async function BrochurePage({ params }: { params: { keyword: string } }) {
  // Try Facebook campaign first, then Instagram
  const fbCampaign = await prisma.facebookBotCampaign.findUnique({
    where: { keyword: params.keyword.toLowerCase() },
  }).catch(() => null)

  const igCampaign = !fbCampaign
    ? await prisma.instagramBotCampaign.findUnique({
        where: { keyword: params.keyword.toLowerCase() },
      }).catch(() => null)
    : null

  const campaign = fbCampaign || igCampaign

  if (!campaign?.pdfUrl) return notFound()

  // Redirect directly to Cloudinary with no framing — works in all browsers
  redirect(campaign.pdfUrl)
}
