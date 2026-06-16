export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function parseKeywords(keywords: string): string[] {
  return keywords.split(",").map(k => k.trim().toUpperCase()).filter(Boolean)
}

function serializeKeywords(arr: string[]): string {
  return [...new Set(arr.map(k => k.trim().toUpperCase()).filter(Boolean))].join(",")
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const campaigns = await prisma.facebookBotCampaign.findMany({
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

    const primaryKeyword = keyword.trim().toUpperCase()
    const campaign = await prisma.facebookBotCampaign.upsert({
      where: { keyword: primaryKeyword },
      update: { name, pdfUrl, pdfName, greeting, isActive: true },
      create: { keyword: primaryKeyword, keywords: primaryKeyword, name, pdfUrl, pdfName, greeting },
    })
    return NextResponse.json(campaign, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 })
  }
}

// PATCH: add or remove a keyword from an existing campaign
export async function PATCH(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id, action, keyword: kw } = await req.json()
    if (!id || !action || !kw?.trim()) {
      return NextResponse.json({ error: "id, action, and keyword are required" }, { status: 400 })
    }

    const campaign = await prisma.facebookBotCampaign.findUnique({ where: { id } })
    if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const current = parseKeywords(campaign.keywords || campaign.keyword)
    const newKw = kw.trim().toUpperCase()

    let updated: string[]
    if (action === "add") {
      updated = [...current, newKw]
    } else if (action === "remove") {
      // Cannot remove the primary keyword if it's the only one
      updated = current.filter(k => k !== newKw)
      if (updated.length === 0) updated = [campaign.keyword.toUpperCase()]
    } else {
      return NextResponse.json({ error: "action must be add or remove" }, { status: 400 })
    }

    const saved = await prisma.facebookBotCampaign.update({
      where: { id },
      data: { keywords: serializeKeywords(updated) },
    })
    return NextResponse.json(saved)
  } catch (e) {
    console.error("Campaign PATCH error:", e)
    return NextResponse.json({ error: "Failed to update keywords" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id } = await req.json()
    await prisma.facebookBotCampaign.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 })
  }
}
