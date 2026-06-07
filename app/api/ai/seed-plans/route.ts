export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { seedFirstTimeHomebuyerPlan } from "@/lib/ai-agent"

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const plan = await seedFirstTimeHomebuyerPlan(session.user?.id)
    return NextResponse.json({ success: true, plan })
  } catch (e) {
    console.error("Seed FTBO plan error:", e)
    return NextResponse.json({ error: "Failed to seed plan" }, { status: 500 })
  }
}
