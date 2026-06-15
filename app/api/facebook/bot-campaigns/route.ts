export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

    const campaign = await prisma.facebookBotCampaign.upsert({
      where: { keyword: keyword.trim().toLowerCase() },
      update: { name, pdfUrl, pdfName, greeting, isActive: true },
      create: { keyword: keyword.trim().toLowerCase(), name, pdfUrl, pdfName, greeting },
    })
    return NextResponse.json(campaign, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 })
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
