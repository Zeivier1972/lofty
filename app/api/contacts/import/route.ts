export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 min — handles up to ~10k rows in one request

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { sendEmail } from "@/lib/email"

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

function normalizePhone(val: string, countryCode?: string): string {
  const digits = val.replace(/[^\d+]/g, "")
  // Only prepend +1 for US/Canada numbers
  const isUS = !countryCode || countryCode.toUpperCase() === "US" || countryCode.toUpperCase() === "CA"
  if (isUS) return digits.replace(/^(\d{10})$/, "+1$1") || val
  // Non-US: keep as-is (already has country code prefix or international format)
  return digits || val
}

// Strip pipe-separated quoted zip values: "33032"|"33034" → ["33032","33034"]
function parsePipedValues(val: string): string[] {
  return val.split("|").map(v => v.replace(/['"]/g, "").trim()).filter(Boolean)
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

    // Detect Lofty format by presence of Lofty-specific columns
    const h = new Set(headers)
    const isLoftyFormat = h.has("first_name") && (
      h.has("lead_type") || h.has("primary_email") || h.has("city_preference") || h.has("city_mailing_address")
    )

    // ── Phase 1: parse rows ──────────────────────────────────────────────
    type ParsedRow = {
      contact: any
      tagNames: string[]
      pipelineName: string
      notesText: string
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
      // Lofty uses "Primary Email"; fallback to generic "email" for other formats
      const email     = (row.primary_email || row.email || row.email_address || "").toLowerCase().trim()
      // Lofty uses "Primary Phone"; country code determines if +1 applies
      const phoneRaw  = (row.primary_phone || row.phone || row.phone_number || row.mobile || row.cell || "").trim()
      const phoneCC   = (row.primary_phone_country_code || row.phone_country_code || "US").trim()

      // Skip rows with no way to contact the lead (no email AND no phone)
      // These are typically bot/test accounts or social handles with no real contact info
      if (!email && !phoneRaw) { parseSkipped++; continue }

      // ── Lofty lead ID (store for reference, strip backticks) ──────────
      const loftyId = (row.lead_id || "").replace(/[`'"]/g, "").trim()

      // ── Address (Lofty: City(Mailing Address) etc.) ───────────────────
      const address = isLoftyFormat
        ? (row.street_address_mailing_address || row.mailing_street_addr_ || row.mailing_street_address || row.address || "").trim()
        : (row.address || row.street || "").trim()
      const city  = (isLoftyFormat
        ? row.city_mailing_address || row.mailing_city
        : row.city)?.trim() || ""
      const state = (isLoftyFormat
        ? row.state_mailing_address || row.mailing_state
        : row.state)?.trim() || ""
      const zip   = (isLoftyFormat
        ? row.zipcode_mailing_address || row.mailing_zip_code || row.mailing_zipcode
        : row.zip)?.trim() || ""

      // ── Status / Source ──────────────────────────────────────────────
      const leadTypeRaw = (row.lead_type || row.type || "buyer").toLowerCase().trim()
      const isSeller    = leadTypeRaw.includes("sell")
      const isRental    = leadTypeRaw.includes("rent") || leadTypeRaw.includes("lease") || leadTypeRaw.includes("tenant")
      const statusRaw   = (row.status || row.lead_status || leadTypeRaw || "lead").toLowerCase()
      const status      = STATUS_MAP[statusRaw] || "LEAD"
      const sourceRaw   = (row.source || row.lead_source || "").toLowerCase().trim()
      // Lofty uses "facebook ads" — normalize to "facebook"
      const sourceNorm  = sourceRaw.replace(" ads", "").replace(" ad", "").replace(".", "")
      const source      = SOURCE_MAP[sourceNorm] || SOURCE_MAP[sourceRaw] || (sourceRaw ? "OTHER" : undefined)

      // ── DNC / Consent ────────────────────────────────────────────────
      const dncRaw    = (row.phone_dnc_status || "").toLowerCase()
      const doNotCall = dncRaw.includes("dnc") || dncRaw.includes("out") || dncRaw === "yes"
      const unsubRaw  = (row.unsubscribed || "").toLowerCase()
      const doNotEmail = unsubRaw.includes("out") || unsubRaw.includes("yes") || unsubRaw.includes("unsub")
      // Check Note 1 for Lofty's "Text Opt-in Yes" consent record
      const note1Text  = (row.note_1 || "").toLowerCase()
      const smsTCPAConsent = note1Text.includes("text opt-in yes") || note1Text.includes("call opt-in: yes")

      // ── Dates ────────────────────────────────────────────────────────
      // Lofty: "Birthday(Detail)" → normalized as "birthday_detail"
      // Lofty Reg Date: "May 23 2026" — JS Date constructor handles this
      const birthday   = parseDate(row.birthday_detail || row.birthday || "")
      const regDateRaw = (row.reg_date || row.registration_date || "").trim()

      // ── Buyer criteria ───────────────────────────────────────────────
      // Lofty: "Min Price(Preference)" → "min_price_preference"
      const maxPrice = parseMoney(row.max_price_preference || row.max_price || row.budget || "")
      const minPrice = parseMoney(row.min_price_preference || row.min_price || "")
      const minBeds  = parseInt(row.min_bedroom || row.min_bedrooms || row.bedrooms || row.beds || "") || null
      const propType = (row.property_type || "").trim() || undefined

      // Lofty: "City(Preference)" → "city_preference"; ZipCode may be pipe-separated
      const prefCity    = (row.city_preference || row.inquired_city || "").trim()
      const prefCounty  = (row.county_preference || row.inquired_county || "").trim()
      const prefZipRaw  = (row.zipcode_preference || row.inquired_zip_code || row.inquired_zipcode || "").trim()
      // Parse pipe-separated zips: "33032"|"33034" → "33032, 33034"
      const prefZips    = parsePipedValues(prefZipRaw).slice(0, 3).join(", ")
      const buyerLocation = [prefCity, prefZips, prefCounty].filter(Boolean).join(", ") || undefined

      // ── Seller properties ────────────────────────────────────────────
      // Lofty exports up to 6 selling properties; use the first one
      const selAddr1  = (row.street_address_selling_property1 || row.property_street_add_ || row.property_street_address || "").trim()
      const selCity1  = (row.city_selling_property1 || row.property_city || "").trim()
      const selState1 = (row.state_selling_property1 || row.property_state || "").trim()
      const sellerAddress = selAddr1 ? `${selAddr1}, ${selCity1} ${selState1}`.trim() : undefined
      const sellerPrice   = parseMoney(row.price || "")

      // ── Custom / extra fields ─────────────────────────────────────────
      const customData: Record<string, string> = {}
      if (loftyId)           customData.loftyId       = loftyId
      if (regDateRaw)        customData.regDate        = regDateRaw
      if (row.buyer_timeframe)  customData.buyerTimeframe = row.buyer_timeframe
      if (row.pre_qualified)    customData.preQualified   = row.pre_qualified
      if (row.language)         customData.language       = row.language.trim()
      // Lofty Custom Field-WhatsApp
      const whatsapp = (row.custom_field_whatsapp || "").trim()
      if (whatsapp)          customData.whatsapp = whatsapp

      // Family members 1–4
      const familyParts: string[] = []
      for (let fm = 1; fm <= 4; fm++) {
        const fFirst = (row[`family_member${fm}_first_name`] || "").trim()
        const fLast  = (row[`family_member${fm}_last_name`]  || "").trim()
        const fEmail = (row[`family_member${fm}_email`]      || "").trim()
        const fPhone = (row[`family_member${fm}_phone`]      || "").trim()
        if (fFirst || fLast || fEmail) {
          familyParts.push(`${fFirst} ${fLast}`.trim() + (fEmail ? ` <${fEmail}>` : "") + (fPhone ? ` ${fPhone}` : ""))
        }
      }
      if (familyParts.length > 0) customData.familyMembers = familyParts.join(" | ")

      // ── Tags — Lofty Tag field is pipe-separated; Segment = pipeline stage ──
      const autoTag    = isRental ? "Rental" : isSeller ? "Seller" : null
      const rawTagStr  = row.tag || row.group1 || row.group2 || ""
      const pipedTags  = parsePipedValues(rawTagStr)   // e.g. ["Parkpoint 2026","2025 pre-construction"]
      const tagNames   = [...pipedTags, autoTag].map(t => t?.trim()).filter(Boolean) as string[]

      // ── Pipeline — Lofty "Segment" holds the stage name ───────────────
      // "Pipeline" column is often empty; "Segment" has e.g. "Warm", "Contacted 1"
      const pipelineName = (row.segment || row.pipeline || "").trim()

      // ── Notes — Lofty exports up to 10 separate Note columns ──────────
      const noteFields = Array.from({ length: 10 }, (_, k) => row[`note_${k + 1}`] || "")
      const combinedNotes = [
        ...noteFields,
        row.notes || "", row.contact_note || "", row.note || "", row.agent_notes || "",
      ].map(n => n.trim()).filter(Boolean).join("\n\n---\n\n")
      const notesText = combinedNotes

      // ── Buyer criteria flag ────────────────────────────────────────────
      const hasBuyerCriteria = !isSeller && (maxPrice || minPrice || minBeds || buyerLocation || propType)
      const matchPrefsCompletedAt = hasBuyerCriteria ? new Date() : undefined

      parsed.push({
        tagNames,
        pipelineName,
        notesText,
        contact: {
          firstName: firstName || "Unknown",
          lastName:  lastName  || "",
          email:     email     || undefined,
          phone:     phoneRaw  ? normalizePhone(phoneRaw, phoneCC) : undefined,
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
          matchPrefsCompletedAt,
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

    // ── Phase 2: look up existing contacts by email for upsert ─────────
    const allEmails = parsed.map(r => r.contact.email).filter(Boolean) as string[]
    const existingByEmail = new Map<string, string>() // email → contactId
    if (allEmails.length > 0) {
      const existing = await prisma.contact.findMany({
        where: { email: { in: allEmails } },
        select: { id: true, email: true },
      })
      existing.forEach(c => { if (c.email) existingByEmail.set(c.email.toLowerCase(), c.id) })
    }

    // ── Phase 3: pre-upsert all tags ────────────────────────────────────
    const allTagNames = Array.from(new Set(parsed.flatMap(r => r.tagNames)))
    const tagIdMap = new Map<string, string>()
    for (const name of allTagNames) {
      if (!name || name.length > 100) continue
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
    const stageMap = new Map<string, string>()
    defaultPipeline?.stages.forEach(s => stageMap.set(s.name.toLowerCase(), s.id))

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"
    const aiConfig = await prisma.aIConfig.findFirst({
      select: { realtorName: true, realtorPhone: true, realtorEmail: true },
    }).catch(() => null)
    const agentName  = aiConfig?.realtorName  || "Catherine Gomez"
    const agentPhone = aiConfig?.realtorPhone || "305-283-0872"

    // ── Phase 5: upsert contacts in batches ─────────────────────────────
    let imported = 0
    let updated = 0
    const emailsSent = 0
    const errors: string[] = []
    const BATCH = 50

    for (let i = 0; i < parsed.length; i += BATCH) {
      const batch = parsed.slice(i, i + BATCH)
      await Promise.all(batch.map(async ({ contact, tagNames, pipelineName, notesText }) => {
        try {
          const emailKey = contact.email?.toLowerCase()
          const existingId = emailKey ? existingByEmail.get(emailKey) : undefined
          let contactId: string
          let isNew = false

          if (existingId) {
            // UPDATE existing — only send non-null fields, never overwrite createdAt
            const updateData: Record<string, any> = {}
            for (const [k, v] of Object.entries(contact)) {
              if (k === "createdAt") continue
              if (v !== null && v !== undefined && v !== "") updateData[k] = v
            }
            await prisma.contact.update({ where: { id: existingId }, data: updateData })
            contactId = existingId
            updated++
          } else {
            const created = await prisma.contact.create({ data: contact })
            contactId = created.id
            if (emailKey) existingByEmail.set(emailKey, contactId)
            isNew = true
            imported++
          }

          // Tags (upsert — safe on re-import)
          if (tagNames.length > 0) {
            const tagConnects = tagNames.map(n => tagIdMap.get(n)).filter(Boolean) as string[]
            await prisma.contactTag.createMany({
              data: tagConnects.map(tagId => ({ contactId, tagId })),
              skipDuplicates: true,
            })
          }

          // Pipeline (only for new contacts — don't add duplicate pipeline entries)
          if (isNew && pipelineName && defaultPipeline) {
            const stageId = stageMap.get(pipelineName.toLowerCase()) || defaultPipeline.stages[0]?.id
            if (stageId) {
              await prisma.pipelineLead.create({ data: { contactId, stageId } }).catch(() => {})
            }
          }

          // Notes — only for new contacts; skip dedup query, use try/catch on unique violation
          if (isNew && notesText) {
            await prisma.note.create({
              data: { content: `[Importado de Lofty]\n\n${notesText}`, contactId, isPinned: false },
            }).catch(() => {})
          }

          // Portal access (new contacts only — no welcome email during bulk import,
          // cron will pick up and send match alerts next run)
          if (isNew) {
            await prisma.clientPortalAccess.create({ data: { contactId } }).catch(() => {})
          }
        } catch (e: any) {
          errors.push(`${contact.firstName} ${contact.lastName || ""}: ${e?.message?.slice(0, 80)}`)
        }
      }))
    }

    return NextResponse.json({
      imported,
      updated,
      emailsSent,
      skipped: parseSkipped,
      errors: errors.slice(0, 10),
      total: lines.length - 1,
    })
  } catch (e: any) {
    console.error("Import error:", e)
    return NextResponse.json({ error: "Failed to process CSV" }, { status: 500 })
  }
}
