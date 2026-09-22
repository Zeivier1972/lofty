export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { buildSofiaFunnel, readFunnel } from "@/lib/sofia-metrics"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const days = Math.min(Math.max(Number(new URL(req.url).searchParams.get("days")) || 30, 1), 120)
  const funnel = await buildSofiaFunnel(days)
  return NextResponse.json({ ...funnel, lectura: readFunnel(funnel) })
}
