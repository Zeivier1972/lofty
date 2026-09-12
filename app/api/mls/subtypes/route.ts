export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { searchIdxListings } from "@/lib/bridge"
import {
  PROPERTY_TYPE_GROUPS,
  MULTI_FAMILY_SUBTYPES,
  MULTI_FAMILY_PROPERTY_TYPES,
} from "@/lib/property-types"

// What does this feed actually call things?
//
// The search filters on exact RESO strings, so a name spelled differently
// matches nothing and the filter reads as broken rather than empty. Two samples
// are needed, not one: duplexes and triplexes are usually filed under the
// "Residential Income" PropertyType, and a sample taken only from "Residential"
// would suggest the feed has none — which is exactly the wrong conclusion that
// hid this bug.
//
// Usage: /api/mls/subtypes  (optionally ?city=Miami&limit=200)
export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const city = searchParams.get("city") || undefined
  const limit = Math.min(Number(searchParams.get("limit")) || 200, 200)

  const tally = (listings: any[]) => {
    const counts = new Map<string, number>()
    for (const l of listings) {
      const t = l?.PropertySubType
      if (t) counts.set(t, (counts.get(t) || 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([subType, count]) => ({ subType, count }))
  }

  try {
    const [residential, income] = await Promise.all([
      searchIdxListings({ city, limit, propertyTypes: ["Residential"] }),
      searchIdxListings({ city, limit, propertyTypes: ["Residential Income"] }).catch(() => []),
    ])

    const residentialSubTypes = tally(residential as any[])
    const incomeSubTypes = tally(income as any[])
    const seen = new Set([
      ...residentialSubTypes.map(r => r.subType),
      ...incomeSubTypes.map(r => r.subType),
    ])

    return NextResponse.json({
      ok: true,
      city: city || "(no city filter)",
      residential: { sampled: residential.length, subTypes: residentialSubTypes },
      residentialIncome: { sampled: income.length, subTypes: incomeSubTypes },
      configured: PROPERTY_TYPE_GROUPS.map(g => ({
        group: g.key,
        label: g.labelEn,
        propertyTypes: g.propertyTypes ?? ["Residential"],
        subTypes: g.subTypes.map(t => ({ subType: t, seenInSample: seen.has(t) })),
      })),
      multiFamily: {
        searchesUnder: MULTI_FAMILY_PROPERTY_TYPES,
        configuredSubTypes: MULTI_FAMILY_SUBTYPES,
        seenInSample: MULTI_FAMILY_SUBTYPES.filter(t => seen.has(t)),
        note: "If residentialIncome.sampled is 0 the feed may not expose that PropertyType at all, in which case the duplexes live in Residential under their own subtype. A configured name missing from both samples is worth re-checking with a larger limit or another city before renaming it — small income property is thin on the ground.",
      },
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 })
  }
}
