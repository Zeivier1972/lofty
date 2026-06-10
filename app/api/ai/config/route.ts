export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  let config = await prisma.aIConfig.findFirst()
  if (!config) {
    config = await prisma.aIConfig.create({
      data: {
        agentName: "Sofia",
        realtorName: "Catherine",
        autoRespondSMS: true,
        autoRespondEmail: true,
        autoFollowUp: true,
        agentPersona: "Eres Sofia, una asistente virtual de bienes raíces amigable y profesional que trabaja para Catherine. Hablas principalmente español.",
      },
    })
  }
  return NextResponse.json(config)
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const {
    agentName, realtorName, realtorPhone, realtorEmail,
    autoRespondSMS, autoRespondEmail, autoFollowUp, autoCallEnabled,
    calendlyUrl, agentPersona, preQualEnabled,
    leadScoreThreshold, followUpDelayHours,
  } = body

  const existing = await prisma.aIConfig.findFirst()
  const data: any = {
    agentName, realtorName, autoRespondSMS, autoRespondEmail, autoFollowUp,
    ...(autoCallEnabled !== undefined && { autoCallEnabled }),
    ...(realtorPhone !== undefined && { realtorPhone }),
    ...(realtorEmail !== undefined && { realtorEmail }),
    ...(calendlyUrl !== undefined && { calendlyUrl }),
    ...(agentPersona !== undefined && { agentPersona }),
    ...(preQualEnabled !== undefined && { preQualEnabled }),
    ...(leadScoreThreshold !== undefined && { leadScoreThreshold }),
    ...(followUpDelayHours !== undefined && { followUpDelayHours }),
  }

  const config = existing
    ? await prisma.aIConfig.update({ where: { id: existing.id }, data })
    : await prisma.aIConfig.create({ data })

  return NextResponse.json(config)
}
