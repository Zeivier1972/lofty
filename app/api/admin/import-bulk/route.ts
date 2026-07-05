export const dynamic = "force-dynamic"
export const maxDuration = 300

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// One-time bulk import endpoint protected by a shared secret.
// Delete this file once the initial lead import is complete.
const IMPORT_SECRET = "PmjAPKD8WVu3aQF9GFbixYfFUsXMnqd_COujkwE3Q7k"

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

function parseMoney(val: string): number | null {
  if (!val) return null
  const n = parseFloat(val.replace(/[$,\s]/g, ""))
  return isNaN(n) ? null : n
}

function parseDate(val: string): Date | null {
  if (!val) return null
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
  const isUS = !countryCode || countryCode.toUpperCase() === "US" || countryCode.toUpperCase() === "CA"
  if (isUS) return digits.replace(/^(\d{10})$/, "+1$1") || val
  return digits || val
}

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

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body || body.secret !== IMPORT_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { csv } = body
  if (!csv?.trim()) return NextResponse.json({ error: "No CSV data" }, { status: 400 })

  try {
    // Look up first admin user to assign contacts to
    const adminUser = await prisma.user.findFirst({ select: { id: true } })
    const assignedToId = adminUser?.id || undefined

    const lines = csv.trim().split(/\r?\n/).filter((l: string) => l.trim())
    if (lines.length < 2) return NextResponse.json({ error: "CSV too short" }, { status: 400 })

    const rawHeaders = parseCSVRow(lines[0])
    const headers = rawHeaders.map(h => h.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/_+$/, ""))
    const h = new Set(headers)
    const isLoftyFormat = h.has("first_name") && (
      h.has("lead_type") || h.has("primary_email") || h.has("city_preference") || h.has("city_mailing_address")
    )

    type ParsedRow = { contact: any; tagNames: string[]; pipelineName: string; notesText: string }
    const parsed: ParsedRow[] = []
    let parseSkipped = 0

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVRow(lines[i])
      const row: Record<string, string> = {}
      headers.forEach((hdr, idx) => { row[hdr] = values[idx] || "" })

      const firstName = (row.first_name || row.firstname || row.first || "").trim()
      const lastName  = (row.last_name  || row.lastname  || row.last  || "").trim()
      const email     = (row.primary_email || row.email || row.email_address || "").toLowerCase().trim()
      const phoneRaw  = (row.primary_phone || row.phone || row.phone_number || row.mobile || row.cell || "").trim()
      const phoneCC   = (row.primary_phone_country_code || row.phone_country_code || "US").trim()

      if (!email && !phoneRaw) { parseSkipped++; continue }

      const loftyId = (row.lead_id || "").replace(/[`'"]/g, "").trim()
      const address = isLoftyFormat
        ? (row.street_address_mailing_address || row.mailing_street_addr_ || row.mailing_street_address || row.address || "").trim()
        : (row.address || row.street || "").trim()
      const city  = (isLoftyFormat ? row.city_mailing_address || row.mailing_city : row.city)?.trim() || ""
      const state = (isLoftyFormat ? row.state_mailing_address || row.mailing_state : row.state)?.trim() || ""
      const zip   = (isLoftyFormat ? row.zipcode_mailing_address || row.mailing_zip_code || row.mailing_zipcode : row.zip)?.trim() || ""

      const leadTypeRaw = (row.lead_type || row.type || "buyer").toLowerCase().trim()
      const isSeller    = leadTypeRaw.includes("sell")
      const isRental    = leadTypeRaw.includes("rent") || leadTypeRaw.includes("lease") || leadTypeRaw.includes("tenant")
      const statusRaw   = (row.status || row.lead_status || leadTypeRaw || "lead").toLowerCase()
      const status      = STATUS_MAP[statusRaw] || "LEAD"
      const sourceRaw   = (row.source || row.lead_source || "").toLowerCase().trim()
      const sourceNorm  = sourceRaw.replace(" ads", "").replace(" ad", "").replace(".", "")
      const source      = SOURCE_MAP[sourceNorm] || SOURCE_MAP[sourceRaw] || (sourceRaw ? "OTHER" : undefined)

      const dncRaw     = (row.phone_dnc_status || "").toLowerCase()
      const doNotCall  = dncRaw.includes("dnc") || dncRaw.includes("out") || dncRaw === "yes"
      const unsubRaw   = (row.unsubscribed || "").toLowerCase()
      const doNotEmail = unsubRaw.includes("out") || unsubRaw.includes("yes") || unsubRaw.includes("unsub")
      const note1Text  = (row.note_1 || "").toLowerCase()
      const smsTCPAConsent = note1Text.includes("text opt-in yes") || note1Text.includes("call opt-in: yes")

      const birthday   = parseDate(row.birthday_detail || row.birthday || "")
      const regDateRaw = (row.reg_date || row.registration_date || "").trim()

      const maxPrice = parseMoney(row.max_price_preference || row.max_price || row.budget || "")
      const minPrice = parseMoney(row.min_price_preference || row.min_price || "")
      const minBeds  = parseInt(row.min_bedroom || row.min_bedrooms || row.bedrooms || row.beds || "") || null
      const propType = (row.property_type || "").trim() || undefined

      const prefCity   = (row.city_preference || row.inquired_city || "").trim()
      const prefCounty = (row.county_preference || row.inquired_county || "").trim()
      const prefZipRaw = (row.zipcode_preference || row.inquired_zip_code || row.inquired_zipcode || "").trim()
      const prefZips   = parsePipedValues(prefZipRaw).slice(0, 3).join(", ")
      const buyerLocation = [prefCity, prefZips, prefCounty].filter(Boolean).join(", ") || undefined

      const selAddr1  = (row.street_address_selling_property1 || row.property_street_add_ || row.property_street_address || "").trim()
      const selCity1  = (row.city_selling_property1 || row.property_city || "").trim()
      const selState1 = (row.state_selling_property1 || row.property_state || "").trim()
      const sellerAddress = selAddr1 ? `${selAddr1}, ${selCity1} ${selState1}`.trim() : undefined
      const sellerPrice   = parseMoney(row.price || "")

      const customData: Record<string, string> = {}
      if (loftyId)          customData.loftyId        = loftyId
      if (regDateRaw)       customData.regDate         = regDateRaw
      if (row.buyer_timeframe) customData.buyerTimeframe = row.buyer_timeframe
      if (row.pre_qualified)   customData.preQualified   = row.pre_qualified
      if (row.language)        customData.language       = row.language.trim()
      const whatsapp = (row.custom_field_whatsapp || "").trim()
      if (whatsapp)         customData.whatsapp = whatsapp

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

      const autoTag   = isRental ? "Rental" : isSeller ? "Seller" : null
      const rawTagStr = row.tag || row.group1 || row.group2 || ""
      const pipedTags = parsePipedValues(rawTagStr)
      const tagNames  = [...pipedTags, autoTag].map(t => t?.trim()).filter(Boolean) as string[]

      const pipelineName = (row.segment || row.pipeline || "").trim()

      const noteFields = Array.from({ length: 10 }, (_, k) => row[`note_${k + 1}`] || "")
      const notesText = [
        ...noteFields,
        row.notes || "", row.contact_note || "", row.note || "", row.agent_notes || "",
      ].map(n => n.trim()).filter(Boolean).join("\n\n---\n\n")

      const hasBuyerCriteria = !isSeller && (maxPrice || minPrice || minBeds || buyerLocation || propType)
      const matchPrefsCompletedAt = hasBuyerCriteria ? new Date() : undefined

      parsed.push({
        tagNames,
        pipelineName,
        notesText,
        contact: {
          firstName: firstName || "Unknown",
          lastName:  lastName  || undefined,
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
          assignedToId,
          customFields: Object.keys(customData).length > 0 ? JSON.stringify(customData) : undefined,
          matchPrefsCompletedAt,
          ...(isSeller ? {
            sellerAddress: sellerAddress || undefined,
            sellerEstimatedValue: sellerPrice || undefined,
          } : {
            buyerBudgetMax:    maxPrice   || undefined,
            buyerBudgetMin:    minPrice   || undefined,
            buyerBedroomsMin:  minBeds    || undefined,
            buyerPropertyType: propType   || undefined,
            buyerLocation:     buyerLocation || undefined,
          }),
        },
      })
    }

    // Existing contacts by email
    const allEmails = parsed.map(r => r.contact.email).filter(Boolean) as string[]
    const existingByEmail = new Map<string, string>()
    if (allEmails.length > 0) {
      const existing = await prisma.contact.findMany({
        where: { email: { in: allEmails } },
        select: { id: true, email: true },
      })
      existing.forEach(c => { if (c.email) existingByEmail.set(c.email.toLowerCase(), c.id) })
    }

    // Pre-upsert tags
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

    // Pipeline stages
    const defaultPipeline = await prisma.pipeline.findFirst({
      where: { isDefault: true },
      include: { stages: true },
    })
    const stageMap = new Map<string, string>()
    defaultPipeline?.stages.forEach(s => stageMap.set(s.name.toLowerCase(), s.id))

    let imported = 0, updated = 0
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

          if (tagNames.length > 0) {
            const tagConnects = tagNames.map(n => tagIdMap.get(n)).filter(Boolean) as string[]
            await prisma.contactTag.createMany({
              data: tagConnects.map(tagId => ({ contactId, tagId })),
              skipDuplicates: true,
            })
          }

          if (isNew && pipelineName && defaultPipeline) {
            const stageId = stageMap.get(pipelineName.toLowerCase()) || defaultPipeline.stages[0]?.id
            if (stageId) {
              await prisma.pipelineLead.create({ data: { contactId, stageId } }).catch(() => {})
            }
          }

          if (isNew && notesText) {
            await prisma.note.create({
              data: { content: `[Importado de Lofty]\n\n${notesText}`, contactId, isPinned: false },
            }).catch(() => {})
          }

          if (isNew) {
            await prisma.clientPortalAccess.create({ data: { contactId } }).catch(() => {})
          }
        } catch (e: any) {
          errors.push(`${contact.firstName} ${contact.lastName || ""}: ${e?.message?.slice(0, 80)}`)
        }
      }))
    }

    return NextResponse.json({ imported, updated, skipped: parseSkipped, errors: errors.slice(0, 20), total: lines.length - 1 })
  } catch (e: any) {
    console.error("[import-bulk]", e)
    return NextResponse.json({ error: "Import failed", detail: e?.message }, { status: 500 })
  }
}
