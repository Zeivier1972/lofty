export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"

export default async function BrochurePage({ params }: { params: { keyword: string } }) {
  const kw = params.keyword

  const fbCampaign = await prisma.facebookBotCampaign.findFirst({
    where: { keyword: { equals: kw, mode: "insensitive" } },
  }).catch(() => null)

  const igCampaign = !fbCampaign
    ? await prisma.instagramBotCampaign.findFirst({
        where: { keyword: { equals: kw, mode: "insensitive" } },
      }).catch(() => null)
    : null

  const campaign = fbCampaign || igCampaign

  if (!campaign?.pdfUrl) return notFound()

  redirect(campaign.pdfUrl)
}
