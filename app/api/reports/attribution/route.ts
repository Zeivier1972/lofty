export const dynamic = "force-dynamic"
export const maxDuration = 60

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// ROI / attribution: source → lead → contacted → appointment → under-contract →
// closed → commission revenue, grouped by lead SOURCE and by CAMPAIGN (utm tag),
// merged with manually-entered ad spend for cost-per-lead and ROI.

const UNDER_CONTRACT_STATUSES = new Set(["UNDER_CONTRACT", "PENDING", "CLOSED"])

type Bucket = {
  key: string
  display: string
  leads: number
  contacted: number
  appointments: number
  underContract: number
  closed: number
  revenue: number
}

function emptyBucket(key: string, display: string): Bucket {
  return { key, display, leads: 0, contacted: 0, appointments: 0, underContract: 0, closed: 0, revenue: 0 }
}

function rangeToSince(range: string): Date | null {
  const days = range === "30" ? 30 : range === "90" ? 90 : range === "365" ? 365 : null
  return days ? new Date(Date.now() - days * 86400000) : null
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const range = new URL(req.url).searchParams.get("range") || "365"
  const since = rangeToSince(range)

  const contacts = await prisma.contact.findMany({
    where: since ? { createdAt: { gte: since } } : {},
    select: {
      source: true,
      lastContacted: true,
      tags: { select: { tag: { select: { name: true } } } },
      _count: { select: { appointments: true } },
      transactions: { select: { status: true, commission: true } },
    },
  })

  const bySource = new Map<string, Bucket>()
  const byCampaign = new Map<string, Bucket>()

  const add = (map: Map<string, Bucket>, key: string, display: string, c: {
    contacted: boolean; hasAppt: boolean; underContract: boolean; closed: boolean; revenue: number
  }) => {
    const k = key.toLowerCase()
    let b = map.get(k)
    if (!b) { b = emptyBucket(k, display); map.set(k, b) }
    b.leads += 1
    if (c.contacted) b.contacted += 1
    if (c.hasAppt) b.appointments += 1
    if (c.underContract) b.underContract += 1
    if (c.closed) { b.closed += 1; b.revenue += c.revenue }
  }

  for (const ct of contacts) {
    const txs = ct.transactions || []
    const underContract = txs.some(t => UNDER_CONTRACT_STATUSES.has(t.status))
    const closed = txs.some(t => t.status === "CLOSED")
    const revenue = txs.filter(t => t.status === "CLOSED").reduce((s, t) => s + (t.commission || 0), 0)
    const flags = { contacted: !!ct.lastContacted, hasAppt: (ct._count?.appointments || 0) > 0, underContract, closed, revenue }

    add(bySource, ct.source || "Sin fuente", ct.source || "Sin fuente", flags)

    for (const tg of ct.tags || []) {
      const name = tg.tag?.name
      if (!name) continue
      if (/^ticket:/i.test(name)) continue // ticket-confirmation tags aren't acquisition campaigns
      add(byCampaign, name, name, flags)
    }
  }

  // Merge manual spend (keyed by lowercased label = source name or tag).
  const spendRows = await prisma.marketingSpend.findMany().catch(() => [])
  const spendMap = new Map(spendRows.map(s => [s.label, s.amount]))

  const decorate = (b: Bucket) => {
    const spend = spendMap.get(b.key) ?? 0
    return {
      ...b,
      spend,
      costPerLead: spend > 0 && b.leads > 0 ? spend / b.leads : null,
      costPerAppt: spend > 0 && b.appointments > 0 ? spend / b.appointments : null,
      roi: spend > 0 ? b.revenue / spend : null,
      leadToApptPct: b.leads > 0 ? b.appointments / b.leads : 0,
      leadToClosedPct: b.leads > 0 ? b.closed / b.leads : 0,
    }
  }

  const sources = Array.from(bySource.values()).map(decorate).sort((a, b) => b.leads - a.leads)
  const campaigns = Array.from(byCampaign.values()).map(decorate).sort((a, b) => b.leads - a.leads).slice(0, 20)

  const totals = sources.reduce((t, s) => ({
    leads: t.leads + s.leads,
    appointments: t.appointments + s.appointments,
    closed: t.closed + s.closed,
    revenue: t.revenue + s.revenue,
    spend: t.spend + s.spend,
  }), { leads: 0, appointments: 0, closed: 0, revenue: 0, spend: 0 })

  return NextResponse.json({ ok: true, range, sources, campaigns, totals })
}

// Save/update manual spend for a source or campaign label.
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const display = String(body.label || "").trim()
  const amount = Number(body.amount)
  if (!display) return NextResponse.json({ error: "label required" }, { status: 400 })
  if (!isFinite(amount) || amount < 0) return NextResponse.json({ error: "invalid amount" }, { status: 400 })

  const label = display.toLowerCase()
  await prisma.marketingSpend.upsert({
    where: { label },
    update: { amount, display },
    create: { label, display, amount },
  })
  return NextResponse.json({ ok: true, label, amount })
}
