export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AUTO_SETTING } from "@/lib/personal-video"

/** On/off for automatic personal videos to new project leads. */
export async function GET() {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const s = await prisma.setting.findUnique({ where: { key: AUTO_SETTING } }).catch(() => null)
  return NextResponse.json({ auto: s?.value === "on", dailyCap: Number(process.env.PERSONAL_VIDEO_DAILY_CAP || 15) })
}

export async function POST(req: Request) {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { auto } = await req.json().catch(() => ({}))
  const value = auto ? "on" : "off"
  await prisma.setting.upsert({ where: { key: AUTO_SETTING }, create: { key: AUTO_SETTING, value }, update: { value } })
  return NextResponse.json({ auto: value === "on" })
}
