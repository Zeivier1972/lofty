export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const SETTING_KEY = "market_insights"
const MAX_LENGTH = 20000

// Free-text market knowledge Catherine wants the Investment Advisor to argue
// from — city-level theses, ROI ranges, talking points. Not project inventory:
// that lives in `preconstruction_projects`.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } })
  return NextResponse.json({ text: row?.value || "" })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const text = typeof body?.text === "string" ? body.text.trim() : ""
  if (text.length > MAX_LENGTH) {
    return NextResponse.json({ error: `Máximo ${MAX_LENGTH.toLocaleString()} caracteres` }, { status: 400 })
  }

  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    update: { value: text },
    create: { key: SETTING_KEY, value: text },
  })

  return NextResponse.json({ ok: true, length: text.length })
}
