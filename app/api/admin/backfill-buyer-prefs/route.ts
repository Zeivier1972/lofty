export const dynamic = "force-dynamic"

// One-time backfill: give every lead a working property search.
//   • Leads with NO buyer preferences → Miami + Homestead, $400k–$650k,
//     and matchPrefsCompletedAt set (activates the hourly auto-alerts).
//   • Leads that HAVE preferences but no matchPrefsCompletedAt → just flip
//     the flag on, so their existing criteria start producing alerts too.
//
//   GET  /api/admin/backfill-buyer-prefs          → preview counts
//   GET  /api/admin/backfill-buyer-prefs?apply=1  → apply
// Session-protected — visit while logged in as the agent.

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const apply = new URL(req.url).searchParams.get("apply") === "1"

  // Group A: no preferences at all — no area AND no budget
  const noPrefsWhere = {
    isArchived: false,
    AND: [
      { OR: [{ buyerLocation: null }, { buyerLocation: "" }] },
      { buyerBudgetMax: null },
    ],
  }

  // Group B: has an area or budget already, but the search was never activated
  const inactiveSearchWhere = {
    isArchived: false,
    matchPrefsCompletedAt: null,
    OR: [
      { buyerLocation: { not: null } },
      { buyerBudgetMax: { not: null } },
    ],
    NOT: { buyerLocation: "" },
  }

  const [noPrefs, inactiveSearch] = await Promise.all([
    prisma.contact.count({ where: noPrefsWhere }),
    prisma.contact.count({ where: inactiveSearchWhere }),
  ])

  if (!apply) {
    return NextResponse.json({
      preview: true,
      leadsWithNoPreferences: noPrefs,
      leadsWithPrefsButNoActiveSearch: inactiveSearch,
      message: `${noPrefs} leads would get Miami + Homestead, $400k–$650k defaults; ${inactiveSearch} leads with existing criteria would have their search activated. Add ?apply=1 to apply.`,
    })
  }

  const now = new Date()
  const [setDefaults, activated] = await Promise.all([
    prisma.contact.updateMany({
      where: noPrefsWhere,
      data: {
        buyerLocation: "Miami, Homestead",
        buyerBudgetMin: 400000,
        buyerBudgetMax: 650000,
        matchPrefsCompletedAt: now,
      },
    }),
    prisma.contact.updateMany({
      where: inactiveSearchWhere,
      data: { matchPrefsCompletedAt: now },
    }),
  ])

  return NextResponse.json({
    applied: true,
    defaultsSet: setDefaults.count,
    searchesActivated: activated.count,
    message: `Gave ${setDefaults.count} leads the Miami + Homestead $400k–$650k default search and activated the existing search on ${activated.count} more. They'll be picked up by the hourly auto-alerts (paced by the daily email budget).`,
  })
}
