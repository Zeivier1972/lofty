export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const SETTING_KEY = "integrations_config"

async function readConfig(): Promise<Record<string, any>> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } })
    return row ? JSON.parse(row.value) : {}
  } catch {
    return {}
  }
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json(await readConfig())
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id, config } = await req.json()
    const existing = await readConfig()
    const updated = { ...existing, [id]: config }
    await prisma.setting.upsert({
      where: { key: SETTING_KEY },
      update: { value: JSON.stringify(updated) },
      create: { key: SETTING_KEY, value: JSON.stringify(updated) },
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}
