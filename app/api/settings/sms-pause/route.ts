export const dynamic = "force-dynamic"

// Global kill switch for AUTOMATED texting (Sofía welcomes, follow-ups, drips,
// stage outreach, SMS alerts). Manual agent-initiated texts are never affected.
//   GET  → { paused: boolean }
//   POST { paused: boolean } → set it
// Session-protected.

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const KEY = "sms_paused"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const row = await prisma.setting.findUnique({ where: { key: KEY } }).catch(() => null)
  return NextResponse.json({ paused: row?.value === "true" })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { paused } = await req.json()
  const value = paused ? "true" : "false"
  await prisma.setting.upsert({
    where: { key: KEY },
    update: { value },
    create: { key: KEY, value },
  })
  return NextResponse.json({ ok: true, paused: paused === true })
}
