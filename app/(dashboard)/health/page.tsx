export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import HealthClient from "./health-client"

export default async function HealthPage() {
  const rows = await prisma.integrationHealth.findMany({ orderBy: { name: "asc" } }).catch(() => [])
  const initial = rows.map(r => ({
    name: r.name,
    ok: r.ok,
    detail: r.detail,
    lastCheckedAt: r.lastCheckedAt?.toISOString() || null,
    lastDownAt: r.lastDownAt?.toISOString() || null,
    consecutiveFailures: r.consecutiveFailures,
  }))
  return <HealthClient initial={initial} />
}
