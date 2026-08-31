export const dynamic = "force-dynamic"
export const maxDuration = 60

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { EVENTS } from "@/lib/events"
import { getTabColumn, appendRowsToTab, buildEventLeadRow } from "@/lib/google-sheets"

// One-time backfill: push existing Bogotá/Medellín event leads into the event
// sheet, each to its city tab. Dry-run by default; add ?apply=1 to write.
// Dedupes by email AND phone against rows already in the tab, so it's safe to
// re-run and won't duplicate leads you already have in the sheet.
//   GET /api/admin/backfill-event-sheet         → preview counts (no writes)
//   GET /api/admin/backfill-event-sheet?apply=1 → actually append
export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const apply = new URL(req.url).searchParams.get("apply") === "1"

  if (!process.env.GOOGLE_SHEETS_LEADS_ID) {
    return NextResponse.json({ error: "GOOGLE_SHEETS_LEADS_ID not configured" }, { status: 400 })
  }

  const results: any[] = []

  for (const ev of EVENTS) {
    const tag = await prisma.tag.findFirst({
      where: { name: { equals: ev.tag, mode: "insensitive" } },
      select: { id: true },
    })
    if (!tag) {
      results.push({ city: ev.city, tab: ev.sheetTab, tagged: 0, note: "event tag not found in CRM" })
      continue
    }

    const links = await prisma.contactTag.findMany({
      where: { tagId: tag.id },
      select: { contact: { select: { firstName: true, lastName: true, email: true, phone: true, createdAt: true } } },
    })
    const contacts = links
      .map(l => l.contact)
      .filter(Boolean) as { firstName: string; lastName: string | null; email: string | null; phone: string | null }[]

    // Dedupe against what's already in the tab (emails col B, phones col C).
    const existingEmails = new Set((await getTabColumn(ev.sheetTab, "B")).map(e => e.toLowerCase()).filter(Boolean))
    const existingPhones = new Set((await getTabColumn(ev.sheetTab, "C")).map(p => p.replace(/\D/g, "")).filter(Boolean))

    const rows: string[][] = []
    let alreadyInSheet = 0
    for (const c of contacts) {
      const email = (c.email || "").toLowerCase()
      const phone = (c.phone || "").replace(/\D/g, "")
      if ((email && existingEmails.has(email)) || (phone && existingPhones.has(phone))) {
        alreadyInSheet++
        continue
      }
      rows.push(buildEventLeadRow({ firstName: c.firstName, lastName: c.lastName || "", email: c.email || undefined, phone: c.phone || undefined }))
      if (email) existingEmails.add(email)
      if (phone) existingPhones.add(phone)
    }

    let appended: number | string = "(dry run — add ?apply=1 to write)"
    if (apply && rows.length) {
      const ok = await appendRowsToTab(ev.sheetTab, rows)
      appended = ok ? rows.length : 0
      if (!ok) appended = "FAILED — check logs"
    } else if (apply) {
      appended = 0
    }

    results.push({
      city: ev.city,
      tab: ev.sheetTab,
      taggedInCRM: contacts.length,
      alreadyInSheet,
      toSync: rows.length,
      appended,
    })
  }

  return NextResponse.json({ ok: true, apply, results })
}
