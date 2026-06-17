export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const campaigns = await prisma.instagramBotCampaign.findMany({
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(campaigns)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { keyword, name, pdfUrl, pdfName, greeting } = await req.json()
    if (!keyword?.trim() || !name?.trim()) {
      return NextResponse.json({ error: "keyword and name are required" }, { status: 400 })
    }

    const campaign = await prisma.instagramBotCampaign.upsert({
      where: { keyword: keyword.trim().toLowerCase() },
      update: { name, pdfUrl, pdfName, greeting, isActive: true },
      create: { keyword: keyword.trim().toLowerCase(), name, pdfUrl, pdfName, greeting },
    })
    return NextResponse.json(campaign, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id, action, keyword } = await req.json()
    const campaign = await prisma.instagramBotCampaign.findUnique({ where: { id } })
    if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const existing = campaign.keywords
      ? campaign.keywords.split(",").map((k: string) => k.trim().toUpperCase()).filter(Boolean)
      : [campaign.keyword.toUpperCase()]

    let updated: string[]
    if (action === "add") {
      const kw = keyword.trim().toUpperCase()
      updated = existing.includes(kw) ? existing : [...existing, kw]
    } else {
      updated = existing.filter((k: string) => k !== keyword.trim().toUpperCase())
      if (updated.length === 0) updated = [campaign.keyword.toUpperCase()]
    }

    const result = await prisma.instagramBotCampaign.update({
      where: { id },
      data: { keywords: updated.join(",") },
    })
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Failed to update keywords" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id } = await req.json()
    await prisma.instagramBotCampaign.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 })
  }
}
