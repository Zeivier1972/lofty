export const dynamic = "force-dynamic"
export const maxDuration = 120

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const IMPORT_SECRET = "PmjAPKD8WVu3aQF9GFbixYfFUsXMnqd_COujkwE3Q7k"

// Sets buyerLocation="Miami" + matchPrefsCompletedAt=now() on every contact
// that has NO buyer search criteria at all (no price, no bedrooms, no location).
// This ensures all imported contacts receive Sofia's property alerts.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body || body.secret !== IMPORT_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const dryRun = body.dryRun === true
  const location = body.location || "Miami"

  // Contacts with no buyer criteria at all
  const targets = await prisma.contact.findMany({
    where: {
      matchPrefsCompletedAt: null,
      buyerBudgetMax: null,
      buyerBudgetMin: null,
      buyerBedroomsMin: null,
      buyerLocation: null,
      buyerPropertyType: null,
      // Only buyer leads — skip sellers
      sellerAddress: null,
    },
    select: { id: true, firstName: true, email: true },
  })

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      wouldUpdate: targets.length,
      sample: targets.slice(0, 10).map(c => ({ name: c.firstName, email: c.email })),
    })
  }

  // Batch update in groups of 500
  const BATCH = 500
  let updated = 0
  for (let i = 0; i < targets.length; i += BATCH) {
    const ids = targets.slice(i, i + BATCH).map(c => c.id)
    const result = await prisma.contact.updateMany({
      where: { id: { in: ids } },
      data: {
        buyerLocation: location,
        matchPrefsCompletedAt: new Date(),
      },
    })
    updated += result.count
  }

  return NextResponse.json({ updated, total: targets.length, location })
}
