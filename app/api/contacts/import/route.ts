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

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { csv } = await req.json()
    if (!csv?.trim()) return NextResponse.json({ error: "No CSV data provided" }, { status: 400 })

    const lines = csv.trim().split("\n").filter((l: string) => l.trim())
    if (lines.length < 2) return NextResponse.json({ error: "CSV must have a header row and at least one data row" }, { status: 400 })

    const headers = parseCSVRow(lines[0]).map((h: string) => h.toLowerCase().replace(/\s+/g, "_"))
    const results = { imported: 0, skipped: 0, errors: [] as string[] }

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVRow(lines[i])
        const row: Record<string, string> = {}
        headers.forEach((h: string, idx: number) => { row[h] = values[idx] || "" })

        const firstName = row.first_name || row.firstname || row.first || ""
        const lastName = row.last_name || row.lastname || row.last || ""
        const email = row.email || row.email_address || ""
        const phone = row.phone || row.phone_number || row.mobile || row.cell || ""

        if (!firstName && !lastName && !email && !phone) { results.skipped++; continue }

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

        const existing = email ? await prisma.contact.findFirst({ where: { email } }) : null
        if (existing) { results.skipped++; continue }

        await prisma.contact.create({
          data: {
            firstName: firstName || "Unknown",
            lastName,
            email: email || undefined,
            phone: phone || undefined,
            status,
            source,
            city: row.city || undefined,
            assignedToId: session?.user?.id as string,
            // IDX search profile fields
            ...(isSeller ? {
              sellerAddress: area || undefined,
              sellerEstimatedValue: budget || undefined,
            } : {
              buyerBudgetMax: budget || undefined,
              buyerLocation: area || undefined,
              buyerBedroomsMin: bedroomsNum || undefined,
              buyerPropertyType: row.property_type || row.type_home || undefined,
            }),
          },
        })
        results.imported++
      } catch (rowErr: any) {
        results.errors.push(`Row ${i + 1}: ${rowErr.message}`)
      }
    }

    return NextResponse.json(results)
  } catch (e: any) {
    console.error("Import error:", e)
    return NextResponse.json({ error: "Failed to process CSV" }, { status: 500 })
  }
}
