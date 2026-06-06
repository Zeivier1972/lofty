export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  const config = await prisma.aIConfig.findFirst()
  if (!config) {
    const created = await prisma.aIConfig.create({
      data: {
        agentName: "Alex",
        realtorName: "Catherine",
        autoRespondSMS: true,
        autoRespondEmail: true,
        autoFollowUp: true,
      },
    })
    return NextResponse.json(created)
  }
  return NextResponse.json(config)
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { agentName, realtorName, autoRespondSMS, autoRespondEmail, autoFollowUp } = body

  const existing = await prisma.aIConfig.findFirst()
  const config = existing
    ? await prisma.aIConfig.update({
        where: { id: existing.id },
        data: { agentName, realtorName, autoRespondSMS, autoRespondEmail, autoFollowUp },
      })
    : await prisma.aIConfig.create({
        data: { agentName, realtorName, autoRespondSMS, autoRespondEmail, autoFollowUp },
      })

  return NextResponse.json(config)
}
