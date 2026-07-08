export const dynamic = "force-dynamic"

// One-time backfill: correctly label imported leads as IMPORT.
//   • Contacts with no source at all → IMPORT
//   • Contacts imported from Lofty (they carry an "[Importado de Lofty]" note)
//     whose source claims a channel like FACEBOOK → IMPORT. A Lofty export is
//     not a new inbound lead; only live-webhook leads keep channel sources.
//     The CSV's original channel stays visible in the contact's note/custom fields.
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

  // Group 1: no source recorded at all
  const noSourceWhere = { OR: [{ source: null }, { source: "" }] }

  // Group 2: imported from Lofty but wearing a channel source (e.g. FACEBOOK).
  // Identified by the "[Importado de Lofty]" note the import writes.
  const loftyRows = await prisma.note.findMany({
    where: { content: { startsWith: "[Importado de Lofty]" } },
    select: { contactId: true },
  })
  const loftyIds = Array.from(new Set(loftyRows.map((n: { contactId: string | null }) => n.contactId).filter(Boolean))) as string[]
  const mislabeledWhere = {
    id: { in: loftyIds },
    NOT: { source: "IMPORT" },
  }

  const [noSource, mislabeled] = await Promise.all([
    prisma.contact.count({ where: noSourceWhere }),
    loftyIds.length ? prisma.contact.count({ where: mislabeledWhere }) : Promise.resolve(0),
  ])

  if (!apply) {
    return NextResponse.json({
      preview: true,
      noSourceContacts: noSource,
      loftyImportsWithChannelSource: mislabeled,
      message: `${noSource} contacts with no source + ${mislabeled} Lofty-imported contacts mislabeled with a channel source (e.g. FACEBOOK) would be marked IMPORT. Add ?apply=1 to apply.`,
    })
  }

  const [r1, r2] = await Promise.all([
    prisma.contact.updateMany({ where: noSourceWhere, data: { source: "IMPORT" } }),
    loftyIds.length
      ? prisma.contact.updateMany({ where: mislabeledWhere, data: { source: "IMPORT" } })
      : Promise.resolve({ count: 0 }),
  ])

  return NextResponse.json({
    applied: true,
    noSourceUpdated: r1.count,
    loftyImportsRelabeled: r2.count,
    message: `Marked ${r1.count} source-less contacts and relabeled ${r2.count} Lofty imports as IMPORT. The 🔵 New Facebook leads filter now only shows real Facebook arrivals.`,
  })
}
