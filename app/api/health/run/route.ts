export const dynamic = "force-dynamic"
export const maxDuration = 60

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { runAllChecks } from "@/lib/health-checks"
import { persistAndAlert } from "@/lib/health-monitor"

// Run all integration health checks on demand from the /health dashboard.
export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const checks = await runAllChecks()
  const monitor = await persistAndAlert(checks).catch(() => ({ transitions: [], alerted: false }))
  return NextResponse.json({ ok: checks.every(c => c.ok), checks, transitions: monitor.transitions })
}
