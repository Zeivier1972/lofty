export const dynamic = "force-dynamic"

// Global kill switch for AUTOMATED texting (Sofía welcomes, follow-ups, drips,
// stage outreach, SMS alerts). Manual agent-initiated texts are never affected.
//   GET  → { paused: boolean }
//   POST { paused: boolean } → set it
// Session-protected.

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { smsSpendThisMonth } from "@/lib/sms"

const KEY = "sms_paused"
const CAP_KEY = "sms_monthly_cap_usd"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const row = await prisma.setting.findUnique({ where: { key: KEY } }).catch(() => null)
  const spend = await smsSpendThisMonth().catch(() => ({ count: 0, spent: 0, cap: 0, over: false }))
  return NextResponse.json({
    paused: row?.value === "true",
    monthlyCap: spend.cap,
    spentThisMonth: Math.round(spend.spent * 100) / 100,
    sentThisMonth: spend.count,
    capReached: spend.over,
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()

  // Update the pause switch when 'paused' is present.
  if (typeof body.paused === "boolean") {
    await prisma.setting.upsert({
      where: { key: KEY },
      update: { value: body.paused ? "true" : "false" },
      create: { key: KEY, value: body.paused ? "true" : "false" },
    })
  }

  // Update the monthly budget cap when 'monthlyCap' is present (>=0; 0 = no cap).
  if (body.monthlyCap != null && !Number.isNaN(Number(body.monthlyCap))) {
    const cap = Math.max(0, Number(body.monthlyCap))
    await prisma.setting.upsert({
      where: { key: CAP_KEY },
      update: { value: String(cap) },
      create: { key: CAP_KEY, value: String(cap) },
    })
  }

  return NextResponse.json({ ok: true })
}
