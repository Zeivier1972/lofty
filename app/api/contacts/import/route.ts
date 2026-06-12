export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

function parseCSVRow(row: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < row.length; i++) {
    if (row[i] === '"') {
      inQuotes = !inQuotes
    } else if (row[i] === "," && !inQuotes) {
      result.push(current.trim())
      current = ""
    } else {
      current += row[i]
    }
  }
  result.push(current.trim())
  return result
}

const STATUS_MAP: Record<string, string> = {
  lead: "LEAD", prospect: "PROSPECT", buyer: "LEAD", seller: "LEAD",
  "active client": "ACTIVE_CLIENT", "past client": "PAST_CLIENT",
  sphere: "SPHERE_OF_INFLUENCE", soi: "SPHERE_OF_INFLUENCE",
}

const SOURCE_MAP: Record<string, string> = {
  zillow: "ZILLOW", realtor: "REALTOR", "realtor.com": "REALTOR",
  facebook: "FACEBOOK", instagram: "INSTAGRAM", google: "GOOGLE",
  referral: "REFERRAL", website: "WEBSITE", "open house": "OPEN_HOUSE",
  "cold call": "COLD_CALL",
}

const BATCH_SIZE = 500

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { csv } = await req.json()
    if (!csv?.trim()) return NextResponse.json({ error: "No CSV data provided" }, { status: 400 })

    const lines = csv.trim().split("\n").filter((l: string) => l.trim())
    if (lines.length < 2) return NextResponse.json({ error: "CSV must have a header row and at least one data row" }, { status: 400 })

    const headers = parseCSVRow(lines[0]).map((h: string) => h.toLowerCase().replace(/\s+/g, "_"))

    // Parse all rows upfront
    const parsed: any[] = []
    let skipped = 0

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVRow(lines[i])
      const row: Record<string, string> = {}
      headers.forEach((h: string, idx: number) => { row[h] = values[idx] || "" })

      const firstName = row.first_name || row.firstname || row.first || ""
      const lastName = row.last_name || row.lastname || row.last || ""
      const email = (row.email || row.email_address || "").toLowerCase().trim()
      const phone = row.phone || row.phone_number || row.mobile || row.cell || ""

      if (!firstName && !lastName && !email && !phone) { skipped++; continue }

      const statusRaw = (row.status || row.lead_status || "lead").toLowerCase()
      const status = STATUS_MAP[statusRaw] || "LEAD"
      const sourceRaw = (row.source || row.lead_source || "").toLowerCase()
      const source = SOURCE_MAP[sourceRaw] || "OTHER"
      const typeRaw = (row.type || row.leadtype || row.lead_type || "buyer").toLowerCase()
      const isSeller = typeRaw.includes("sell")
      const budgetStr = row.budget || row.price || row.maxprice || row.max_price || ""
      const budget = budgetStr ? parseInt(budgetStr.replace(/[^0-9]/g, "")) || null : null
      const area = row.area || row.city || row.neighborhood || row.location || null
      const bedrooms = row.bedrooms || row.beds || row.min_beds || ""
      const bedroomsNum = bedrooms ? parseInt(bedrooms) || null : null

      parsed.push({
        firstName: firstName || "Unknown",
        lastName: lastName || undefined,
        email: email || undefined,
        phone: phone || undefined,
        status,
        source,
        city: row.city || undefined,
        assignedToId: session?.user?.id as string,
        ...(isSeller ? {
          sellerAddress: area || undefined,
          sellerEstimatedValue: budget || undefined,
        } : {
          buyerBudgetMax: budget || undefined,
          buyerLocation: area || undefined,
          buyerBedroomsMin: bedroomsNum || undefined,
          buyerPropertyType: row.property_type || row.type_home || undefined,
        }),
      })
    }

    // Bulk dedup: fetch all existing emails in one query
    const emails = parsed.map(r => r.email).filter(Boolean)
    const existingEmails = new Set<string>()
    if (emails.length > 0) {
      const existing = await prisma.contact.findMany({
        where: { email: { in: emails } },
        select: { email: true },
      })
      existing.forEach(c => { if (c.email) existingEmails.add(c.email.toLowerCase()) })
    }

    const toInsert = parsed.filter(r => !r.email || !existingEmails.has(r.email.toLowerCase()))
    skipped += parsed.length - toInsert.length

    // Batch insert in chunks of BATCH_SIZE
    let imported = 0
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE)
      const result = await prisma.contact.createMany({
        data: batch,
        skipDuplicates: true,
      })
      imported += result.count
    }

    return NextResponse.json({ imported, skipped, total: lines.length - 1 })
  } catch (e: any) {
    console.error("Import error:", e)
    return NextResponse.json({ error: "Failed to process CSV" }, { status: 500 })
  }
}
