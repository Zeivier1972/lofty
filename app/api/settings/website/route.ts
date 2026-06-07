export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  try {
    const config = await prisma.websiteConfig.findFirst()
    return NextResponse.json(config)
  } catch {
    return NextResponse.json(null)
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const data = await req.json()
    const { id, updatedAt, ...updateData } = data

    const existing = await prisma.websiteConfig.findFirst()
    if (existing) {
      const config = await prisma.websiteConfig.update({
        where: { id: existing.id },
        data: updateData,
      })
      return NextResponse.json(config)
    } else {
      const config = await prisma.websiteConfig.create({ data: updateData })
      return NextResponse.json(config)
    }
  } catch (e) {
    console.error("Website config save error:", e)
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}
