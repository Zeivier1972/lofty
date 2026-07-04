export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// US state abbreviations to strip out
const STATE_CODES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
])

// Words that appear in Lofty exports but are not valid location names
const JUNK_WORDS = new Set([
  "america","united states","us","usa","null","none","n/a","na","other","unknown",
])

function cleanBuyerLocation(raw: string): string {
  const parts = raw.split(",").map(s => s.trim()).filter(Boolean)
  const seen = new Set<string>()
  const result: string[] = []

  for (const part of parts) {
    // Drop pure state codes (exactly 2 uppercase letters)
    if (STATE_CODES.has(part.toUpperCase()) && part.length === 2) continue
    // Drop junk words
    if (JUNK_WORDS.has(part.toLowerCase())) continue
    // Keep 5-digit zip codes as-is
    if (/^\d{5}$/.test(part)) {
      if (!seen.has(part)) { seen.add(part); result.push(part) }
      continue
    }
    // Drop anything that's purely numeric but not a zip
    if (/^\d+$/.test(part)) continue
    // Capitalize city name (Title Case first word)
    const city = part.replace(/^(\w)/, c => c.toUpperCase())
    const key = city.toLowerCase()
    if (!seen.has(key)) { seen.add(key); result.push(city) }
  }

  return result.join(", ")
}

/**
 * POST /api/admin/cleanup-buyer-location
 * One-time cleanup: fixes messy buyerLocation values like
 * "miami,FL, 33158, America,FL" → "Miami, 33158"
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { dryRun = false } = await req.json().catch(() => ({}))

  // Find contacts whose buyerLocation has state codes or junk
  const contacts = await prisma.contact.findMany({
    where: {
      buyerLocation: { not: null },
      OR: [
        { buyerLocation: { contains: ",FL" } },
        { buyerLocation: { contains: ",CA" } },
        { buyerLocation: { contains: ",TX" } },
        { buyerLocation: { contains: ",NY" } },
        { buyerLocation: { contains: "America" } },
        { buyerLocation: { contains: " FL" } },
      ],
    },
    select: { id: true, firstName: true, buyerLocation: true },
  })

  const changes: { id: string; name: string; before: string; after: string }[] = []

  for (const contact of contacts) {
    const before = contact.buyerLocation!
    const after = cleanBuyerLocation(before)
    if (after !== before) {
      changes.push({ id: contact.id, name: contact.firstName, before, after })
    }
  }

  if (!dryRun) {
    await Promise.all(
      changes.map(c => prisma.contact.update({
        where: { id: c.id },
        data: { buyerLocation: c.after || null },
      }))
    )
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    total: contacts.length,
    changed: changes.length,
    preview: changes.slice(0, 20),
  })
}
