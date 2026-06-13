export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// ─── CSV parser (handles quoted fields with commas) ────────────────────────
function parseCSVRow(row: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < row.length; i++) {
    if (row[i] === '"') { inQuotes = !inQuotes }
    else if (row[i] === "," && !inQuotes) { result.push(current.trim()); current = "" }
    else { current += row[i] }
  }
  result.push(current.trim())
  return result
}

// ─── Normalise helpers ─────────────────────────────────────────────────────
function parseMoney(val: string): number | null {
  if (!val) return null
  const n = parseFloat(val.replace(/[$,\s]/g, ""))
  return isNaN(n) ? null : n
}

function parseDate(val: string): Date | null {
  if (!val) return null
  // MM/DD/YYYY
  const [m, d, y] = val.split("/")
  if (m && d && y) {
    const dt = new Date(+y, +m - 1, +d)
    return isNaN(dt.getTime()) ? null : dt
  }
  const dt = new Date(val)
  return isNaN(dt.getTime()) ? null : dt
}

function normalizePhone(val: string): string {
  return val.replace(/[^\d+]/g, "").replace(/^(\d{10})$/, "+1$1") || val
}

const STATUS_MAP: Record<string, string> = {
  lead: "LEAD", prospect: "PROSPECT", buyer: "LEAD", seller: "LEAD",
  rental: "LEAD", renter: "LEAD", tenant: "LEAD", lease: "LEAD",
  "active client": "ACTIVE_CLIENT", "past client": "PAST_CLIENT",
  sphere: "SPHERE_OF_INFLUENCE", soi: "SPHERE_OF_INFLUENCE",
}

const SOURCE_MAP: Record<string, string> = {
  zillow: "ZILLOW", realtor: "REALTOR", "realtor.com": "REALTOR",
  facebook: "FACEBOOK", instagram: "INSTAGRAM", google: "GOOGLE",
  referral: "REFERRAL", website: "WEBSITE", "open house": "OPEN_HOUSE",
  "cold call": "COLD_CALL", other: "OTHER",
}

// ─── Main handler ──────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { csv } = await req.json()
    if (!csv?.trim()) return NextResponse.json({ error: "No CSV data provided" }, { status: 400 })

    const lines = csv.trim().split(/\r?\n/).filter((l: string) => l.trim())
    if (lines.length < 2) return NextResponse.json({ error: "CSV must have headers + at least one row" }, { status: 400 })

    // Normalize header names: lower-case, spaces → underscores
    const rawHeaders = parseCSVRow(lines[0])
    const headers = rawHeaders.map(h => h.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/_+$/, ""))

    // Detect Lofty format: has "first_name" and "mailing_city" etc.
    const h = new Set(headers)
    const isLoftyFormat = h.has("first_name") && (h.has("mailing_city") || h.has("mailing_street_addr_") || h.has("lead_type"))

    // ── Phase 1: parse rows ──────────────────────────────────────────────
    type ParsedRow = {
      contact: any
      tagNames: string[]
      pipelineName: string
    }
    const parsed: ParsedRow[] = []
    let parseSkipped = 0

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVRow(lines[i])
      const row: Record<string, string> = {}
      headers.forEach((h, idx) => { row[h] = values[idx] || "" })

      // ── Names ────────────────────────────────────────────────────────
      const firstName = (row.first_name || row.firstname || row.first || "").trim()
      const lastName  = (row.last_name  || row.lastname  || row.last  || "").trim()
      const email     = (row.email || row.email_address || "").toLowerCase().trim()
      const phone     = row.phone || row.phone_number || row.mobile || row.cell || ""

      if (!firstName && !lastName && !email && !phone) { parseSkipped++; continue }

      // ── Address ──────────────────────────────────────────────────────
      const address = isLoftyFormat
        ? (row.mailing_street_addr_ || row.mailing_street_address || row.mailing_street_addr || "").trim()
        : (row.address || row.street || "").trim()
      const city  = (isLoftyFormat ? row.mailing_city  : row.city)?.trim()  || ""
      const state = (isLoftyFormat ? row.mailing_state : row.state)?.trim() || ""
      const zip   = (isLoftyFormat ? row.mailing_zip_code || row.mailing_zipcode : row.zip)?.trim() || ""

      // ── Status / Source ──────────────────────────────────────────────
      const leadTypeRaw = (row.lead_type || row.type || "buyer").toLowerCase()
      const isSeller    = leadTypeRaw.includes("sell")
      const isRental    = leadTypeRaw.includes("rent") || leadTypeRaw.includes("lease") || leadTypeRaw.includes("tenant")
      const statusRaw   = (row.status || row.lead_status || leadTypeRaw || "lead").toLowerCase()
      const status      = STATUS_MAP[statusRaw] || "LEAD"
      const sourceRaw   = (row.source || row.lead_source || "").toLowerCase()
      const source      = SOURCE_MAP[sourceRaw] || (sourceRaw ? "OTHER" : undefined)

      // ── DNC / Consent ────────────────────────────────────────────────
      const dncRaw    = (row.phone_dnc_status || "").toLowerCase()
      const doNotCall = dncRaw.includes("dnc") || dncRaw.includes("out") || dncRaw === "yes"
      const unsubRaw  = (row.unsubscribed || "").toLowerCase()
      const doNotEmail = unsubRaw.includes("out") || unsubRaw.includes("yes") || unsubRaw.includes("unsub")
      const consentRaw = (row.number_consent || "").toLowerCase()
      const smsTCPAConsent = consentRaw.includes("known") || consentRaw.includes("yes") || consentRaw === "consent"

      // ── Dates ────────────────────────────────────────────────────────
      const birthday    = parseDate(row.birthday || "")
      const regDateRaw  = row.reg_date || row.registration_date || ""
      // reg_date used as createdAt proxy — store in notes below

      // ── Buyer criteria ───────────────────────────────────────────────
      const maxPrice      = parseMoney(row.max_price || row.budget || row.price || "")
      const minPrice      = parseMoney(row.min_price || "")
      const minBeds       = parseInt(row.min_bedroom || row.min_bedrooms || row.bedrooms || row.beds || "") || null
      const propType      = (row.property_type || "").trim() || undefined
      const inquiredCity  = row.inquired_city || ""
      const inquiredState = row.inquired_state || ""
      const inquiredZip   = row.inquired_zip_code || row.inquired_zipcode || ""
      const inquiredCounty = row.inquired_county || ""
      const buyerLocation = [inquiredCity, inquiredState, inquiredZip, inquiredCounty].filter(Boolean).join(", ") || undefined

      // ── Seller ───────────────────────────────────────────────────────
      const propAddress = (row.property_street_add_ || row.property_street_address || "").trim()
      const propCity    = (row.property_city || "").trim()
      const propState   = (row.property_state || "").trim()
      const sellerAddress = propAddress ? `${propAddress}, ${propCity} ${propState}`.trim() : undefined
      const sellerPrice   = parseMoney(row.price || "")

      // ── Custom fields (extra info) ────────────────────────────────────
      const customData: Record<string, string> = {}
      if (row.buyer_timeframe) customData.buyerTimeframe = row.buyer_timeframe
      if (row.pre_qualified)   customData.preQualified   = row.pre_qualified
      const familyFirst = row.family_member_first_name || ""
      const familyLast  = row.family_member_last_name  || ""
      if (familyFirst || familyLast) customData.familyMember = `${familyFirst} ${familyLast}`.trim()
      if (row.family_member_email) customData.familyEmail = row.family_member_email
      if (row.family_member_phone) customData.familyPhone = row.family_member_phone
      if (regDateRaw) customData.regDate = regDateRaw

      // ── Tags ─────────────────────────────────────────────────────────
      // Auto-add a "Rental" tag for rental leads so they're easy to filter
      const autoTag = isRental ? "Rental" : isSeller ? "Seller" : null
      const tagNames = [row.tag, row.group1, row.group2, autoTag]
        .map(t => t?.trim())
        .filter(Boolean) as string[]

      // ── Pipeline ──────────────────────────────────────────────────────
      const pipelineName = (row.pipeline || "").trim()

      parsed.push({
        tagNames,
        pipelineName,
        contact: {
          firstName: firstName || "Unknown",
          lastName:  lastName  || undefined,
          email:     email     || undefined,
          phone:     phone     ? normalizePhone(phone) : undefined,
          address:   address   || undefined,
          city:      city      || undefined,
          state:     state     || undefined,
          zip:       zip       || undefined,
          source,
          status,
          doNotCall,
          doNotEmail,
          smsTCPAConsent,
          birthday,
          assignedToId: (session.user as any)?.id,
          customFields: Object.keys(customData).length > 0 ? JSON.stringify(customData) : undefined,
          ...(isSeller ? {
            sellerAddress: sellerAddress || undefined,
            sellerEstimatedValue: sellerPrice || undefined,
          } : {
            // applies to both Buyer and Rental leads
            buyerBudgetMax:    maxPrice   || undefined,
            buyerBudgetMin:    minPrice   || undefined,
            buyerBedroomsMin:  minBeds    || undefined,
            buyerPropertyType: propType   || undefined,
            buyerLocation:     buyerLocation || undefined,
          }),
        },
      })
    }

    // ── Phase 2: deduplicate by email ───────────────────────────────────
    const allEmails = parsed.map(r => r.contact.email).filter(Boolean)
    const existingEmailSet = new Set<string>()
    if (allEmails.length > 0) {
      const existing = await prisma.contact.findMany({
        where: { email: { in: allEmails } },
        select: { email: true },
      })
      existing.forEach(c => { if (c.email) existingEmailSet.add(c.email.toLowerCase()) })
    }

    const toCreate = parsed.filter(r => !r.contact.email || !existingEmailSet.has(r.contact.email.toLowerCase()))
    const dupSkipped = parsed.length - toCreate.length

    // ── Phase 3: pre-upsert all tags ────────────────────────────────────
    const allTagNames = Array.from(new Set(toCreate.flatMap(r => r.tagNames)))
    const tagIdMap = new Map<string, string>()
    for (const name of allTagNames) {
      const tag = await prisma.tag.upsert({
        where: { name },
        create: { name, color: "#6366F1" },
        update: {},
      })
      tagIdMap.set(name, tag.id)
    }

    // ── Phase 4: pre-fetch pipeline stages ──────────────────────────────
    const defaultPipeline = await prisma.pipeline.findFirst({
      where: { isDefault: true },
      include: { stages: true },
    })
    const stageMap = new Map<string, string>() // stage name (lower) → stageId
    defaultPipeline?.stages.forEach(s => stageMap.set(s.name.toLowerCase(), s.id))

    // ── Phase 5: create contacts in batches of 25 ───────────────────────
    let imported = 0
    const errors: string[] = []
    const BATCH = 25

    for (let i = 0; i < toCreate.length; i += BATCH) {
      const batch = toCreate.slice(i, i + BATCH)
      await Promise.all(batch.map(async ({ contact, tagNames, pipelineName }) => {
        try {
          const created = await prisma.contact.create({ data: contact })

          // Tags
          if (tagNames.length > 0) {
            const tagConnects = tagNames
              .map(n => tagIdMap.get(n))
              .filter(Boolean) as string[]
            await prisma.contactTag.createMany({
              data: tagConnects.map(tagId => ({ contactId: created.id, tagId })),
              skipDuplicates: true,
            })
          }

          // Pipeline
          if (pipelineName && defaultPipeline) {
            const stageId = stageMap.get(pipelineName.toLowerCase())
              || defaultPipeline.stages[0]?.id
            if (stageId) {
              await prisma.pipelineLead.create({
                data: { contactId: created.id, stageId },
              })
            }
          }

          // Activity log
          await prisma.activity.create({
            data: {
              type: "CONTACT_CREATED",
              title: `Lead importado: ${created.firstName} ${created.lastName || ""}`.trim(),
              contactId: created.id,
            },
          }).catch(() => {})

          imported++
        } catch (e: any) {
          errors.push(`${contact.firstName} ${contact.lastName || ""}: ${e?.message?.slice(0, 80)}`)
        }
      }))
    }

    return NextResponse.json({
      imported,
      skipped: parseSkipped + dupSkipped,
      errors: errors.slice(0, 10),
      total: lines.length - 1,
    })
  } catch (e: any) {
    console.error("Import error:", e)
    return NextResponse.json({ error: "Failed to process CSV" }, { status: 500 })
  }
}
