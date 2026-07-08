export const dynamic = "force-dynamic"

// One-time backfill: label contacts that have no source as "IMPORT" so the
// leads that were imported show the "Import" badge in the CRM.
//   GET  /api/admin/backfill-import-source          → preview (how many would change)
//   GET  /api/admin/backfill-import-source?apply=1  → apply the change
// Session-protected — just visit it while logged in as the agent.

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const apply = new URL(req.url).searchParams.get("apply") === "1"

  // Contacts with no source recorded — these are the ones imported (or added)
  // without a channel. Empty string and NULL both count as "no source".
  const where = { OR: [{ source: null }, { source: "" }] }

  const count = await prisma.contact.count({ where })

  if (!apply) {
    return NextResponse.json({
      preview: true,
      wouldUpdate: count,
      message: `${count} contacts have no source and would be marked as IMPORT. Add ?apply=1 to the URL to apply.`,
    })
  }

  const result = await prisma.contact.updateMany({ where, data: { source: "IMPORT" } })
  return NextResponse.json({
    applied: true,
    updated: result.count,
    message: `Marked ${result.count} contacts as IMPORT. Refresh your Contacts list to see the badges.`,
  })
}
