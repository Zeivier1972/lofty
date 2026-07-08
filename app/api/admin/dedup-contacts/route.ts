export const dynamic = "force-dynamic"
export const maxDuration = 120

// Find and clean up duplicate contacts (same phone number or same email).
// Keeps the best record of each group (has email > most activity > oldest),
// fills the keeper's missing email/phone from its duplicates, then archives
// the duplicates and removes them from the pipeline so lists show one person.
//   GET  /api/admin/dedup-contacts          → preview groups
//   GET  /api/admin/dedup-contacts?apply=1  → apply the cleanup
// Session-protected. Archiving is reversible (isArchived flag).

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

function phoneKey(phone: string | null): string | null {
  const digits = (phone || "").replace(/\D/g, "")
  if (digits.length < 7) return null
  return digits.slice(-10)
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const apply = new URL(req.url).searchParams.get("apply") === "1"

  const contacts = await prisma.contact.findMany({
    where: { isArchived: false },
    select: {
      id: true, firstName: true, lastName: true, email: true, phone: true, createdAt: true,
      _count: { select: { activities: true, notes: true, dialerCalls: true, emails: true, tasks: true } },
    },
  })

  // Union-find: contacts sharing an email or a phone number are the same person
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    let r = x
    while (parent.get(r) !== r) r = parent.get(r)!
    // path compression
    let c = x
    while (parent.get(c) !== r) { const n = parent.get(c)!; parent.set(c, r); c = n }
    return r
  }
  const union = (a: string, b: string) => { parent.set(find(a), find(b)) }

  for (const c of contacts) parent.set(c.id, c.id)
  const byKey = new Map<string, string>() // email/phone key → first contact id
  for (const c of contacts) {
    const keys = [c.email?.toLowerCase().trim() || null, phoneKey(c.phone)].filter(Boolean) as string[]
    for (const k of keys) {
      const first = byKey.get(k)
      if (first) union(c.id, first)
      else byKey.set(k, c.id)
    }
  }

  // Collect groups with more than one member
  const groups = new Map<string, typeof contacts>()
  for (const c of contacts) {
    const root = find(c.id)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root)!.push(c)
  }
  const dupGroups = Array.from(groups.values()).filter(g => g.length > 1)

  const richness = (c: (typeof contacts)[number]) =>
    c._count.activities + c._count.notes + c._count.dialerCalls + c._count.emails + c._count.tasks

  const plans = dupGroups.map(g => {
    const sorted = [...g].sort((a, b) =>
      (b.email ? 1 : 0) - (a.email ? 1 : 0) ||
      richness(b) - richness(a) ||
      a.createdAt.getTime() - b.createdAt.getTime()
    )
    const keeper = sorted[0]
    const dupes = sorted.slice(1)
    return { keeper, dupes }
  })

  const totalDupes = plans.reduce((s, p) => s + p.dupes.length, 0)

  if (!apply) {
    return NextResponse.json({
      preview: true,
      duplicateGroups: plans.length,
      contactsToArchive: totalDupes,
      samples: plans.slice(0, 25).map(p => ({
        keep: `${p.keeper.firstName} ${p.keeper.lastName || ""}`.trim() + (p.keeper.phone ? ` (${p.keeper.phone})` : ""),
        archive: p.dupes.map(d => `${d.firstName} ${d.lastName || ""}`.trim() + (d.phone ? ` (${d.phone})` : "")),
      })),
      message: `${plans.length} duplicate groups found — ${totalDupes} duplicate contacts would be archived (the best record of each group is kept). Add ?apply=1 to apply.`,
    })
  }

  let archived = 0
  let enriched = 0
  for (const { keeper, dupes } of plans) {
    // Fill the keeper's missing email/phone from its duplicates
    const fill: Record<string, string> = {}
    if (!keeper.email) { const d = dupes.find(x => x.email); if (d?.email) fill.email = d.email }
    if (!keeper.phone) { const d = dupes.find(x => x.phone); if (d?.phone) fill.phone = d.phone }
    if (Object.keys(fill).length) {
      await prisma.contact.update({ where: { id: keeper.id }, data: fill }).catch(() => {})
      enriched++
    }
    const dupIds = dupes.map(d => d.id)
    await prisma.pipelineLead.deleteMany({ where: { contactId: { in: dupIds } } }).catch(() => {})
    const r = await prisma.contact.updateMany({ where: { id: { in: dupIds } }, data: { isArchived: true } })
    archived += r.count
  }

  return NextResponse.json({
    applied: true,
    duplicateGroups: plans.length,
    archived,
    keepersEnriched: enriched,
    message: `Archived ${archived} duplicates across ${plans.length} groups. Each kept contact stays in the pipeline; ${enriched} keepers were filled in with an email/phone from their duplicate.`,
  })
}
