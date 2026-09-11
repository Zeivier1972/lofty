export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { searchIdxListings } from "@/lib/bridge"
import { PROPERTY_TYPE_GROUPS, MULTI_FAMILY_SUBTYPES } from "@/lib/property-types"

// Which PropertySubType values does this feed actually use?
//
// The search filters on exact RESO strings, so a name the feed spells
// differently matches nothing and the filter looks broken rather than empty —
// the failure is silent, which is the worst kind. Sample live listings, tally
// what comes back, and say plainly which of our configured names were seen.
//
// Usage: /api/mls/subtypes  (optionally ?city=Miami&limit=200)
export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const city = searchParams.get("city") || undefined
  const limit = Math.min(Number(searchParams.get("limit")) || 200, 200)

  try {
    const listings = await searchIdxListings({ city, limit })

    const counts = new Map<string, number>()
    for (const l of listings as any[]) {
      const t = l?.PropertySubType
      if (t) counts.set(t, (counts.get(t) || 0) + 1)
    }
    const seen = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([subType, count]) => ({ subType, count }))
    const seenNames = new Set(counts.keys())

    const configured = PROPERTY_TYPE_GROUPS.map(g => ({
      group: g.key,
      label: g.labelEn,
      subTypes: g.subTypes.map(t => ({ subType: t, seenInSample: seenNames.has(t) })),
    }))

    return NextResponse.json({
      ok: true,
      sampled: listings.length,
      city: city || "(no city filter)",
      subTypesInFeed: seen,
      configured,
      multiFamily: {
        configured: MULTI_FAMILY_SUBTYPES,
        seenInSample: MULTI_FAMILY_SUBTYPES.filter(t => seenNames.has(t)),
        note: "A configured name missing here is not proof the feed lacks it — this is one sample of active listings, and small-income property is thin on the ground. Re-run with a larger limit or a different city before renaming anything.",
      },
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 })
  }
}
