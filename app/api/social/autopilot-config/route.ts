export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

async function getConfig() {
  let config = await prisma.socialAutoPilotConfig.findFirst()
  if (!config) {
    config = await prisma.socialAutoPilotConfig.create({ data: {} })
  }
  return config
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json(await getConfig())
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const config = await getConfig()
  const data: Record<string, boolean> = {}
  if (typeof body.isEnabled === "boolean") data.isEnabled = body.isEnabled
  if (typeof body.videoEnabled === "boolean") data.videoEnabled = body.videoEnabled
  const updated = await prisma.socialAutoPilotConfig.update({
    where: { id: config.id },
    data,
  })
  return NextResponse.json(updated)
}
