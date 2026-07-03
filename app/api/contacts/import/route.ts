export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 min — large CSV imports need time for DB writes + welcome emails

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

      if (!firstName && !lastName && !email && !phoneRaw) { parseSkipped++; continue }

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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"
    const aiConfig = await prisma.aIConfig.findFirst({
      select: { realtorName: true, realtorPhone: true, realtorEmail: true },
    }).catch(() => null)
    const agentName  = aiConfig?.realtorName  || "Catherine Gomez"
    const agentPhone = aiConfig?.realtorPhone || "305-283-0872"

    // ── Phase 5: create contacts in batches of 25 ───────────────────────
    let imported = 0
    let emailsSent = 0
    const errors: string[] = []
    const BATCH = 25

    for (let i = 0; i < toCreate.length; i += BATCH) {
      const batch = toCreate.slice(i, i + BATCH)
      await Promise.all(batch.map(async ({ contact, tagNames, pipelineName, notesText }) => {
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

          // Notes from previous CRM
          if (notesText) {
            await prisma.note.create({
              data: {
                content: `[Importado de Lofty]\n\n${notesText}`,
                contactId: created.id,
                isPinned: false,
              },
            }).catch(() => {})
          }

          // Portal access — required for match-alert cron to send emails
          const access = await prisma.clientPortalAccess.create({
            data: { contactId: created.id },
          }).catch(() => null)

          // Welcome email — fire-and-forget so it doesn't block the import batch
          if (access && created.email && !created.doNotEmail) {
            const portalUrl = `${appUrl}/portal/login?token=${access.token}`
            const hasCriteria = created.buyerBudgetMax || created.buyerLocation || created.buyerBedroomsMin
            sendEmail({
              to: created.email,
              subject: `🏠 ${agentName} — Your property search continues here`,
              html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%">
  <tr><td style="background:linear-gradient(135deg,#0a1628 0%,#1a2f50 100%);border-radius:16px 16px 0 0;padding:32px;text-align:center">
    <p style="color:#c9a84c;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:0 0 8px">✨ SOFIA · AI Real Estate Assistant</p>
    <h1 style="color:white;font-size:24px;font-weight:900;margin:0 0 6px">Your Client Portal Is Ready</h1>
    <p style="color:#8fa3c4;font-size:14px;margin:0">Tu portal personal de búsqueda de propiedades</p>
  </td></tr>
  <tr><td style="background:white;padding:28px 28px 8px">
    <p style="color:#374151;font-size:15px;margin:0 0 12px">Hola <strong>${created.firstName}</strong>! 👋</p>
    <p style="color:#374151;font-size:14px;margin:0 0 16px">
      I'm Sofía, ${agentName}'s AI assistant. We've set up your personal client portal so your property search continues seamlessly — everything you were working on is here.
    </p>
    ${hasCriteria ? `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;margin:0 0 20px">
      <p style="color:#15803d;font-size:13px;font-weight:700;margin:0 0 6px">✅ Your search preferences are set</p>
      <p style="color:#374151;font-size:13px;margin:0">Sofía will automatically alert you when new homes matching your criteria hit the market.</p>
    </div>` : ""}
    <p style="color:#374151;font-size:14px;margin:0 0 20px">With your portal you can:</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px">
      <tr><td style="padding:6px 0;font-size:14px;color:#374151">🏠 &nbsp;Ver propiedades recomendadas para ti</td></tr>
      <tr><td style="padding:6px 0;font-size:14px;color:#374151">🔔 &nbsp;Recibir alertas automáticas de nuevas propiedades</td></tr>
      <tr><td style="padding:6px 0;font-size:14px;color:#374151">❤️ &nbsp;Guardar tus propiedades favoritas</td></tr>
      <tr><td style="padding:6px 0;font-size:14px;color:#374151">💬 &nbsp;Enviarme mensajes directamente</td></tr>
    </table>
    <div style="text-align:center;margin:0 0 24px">
      <a href="${portalUrl}" style="display:inline-block;background:#0e1f3d;color:white;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
        Acceder a Mi Portal →
      </a>
      <p style="color:#9ca3af;font-size:12px;margin:12px 0 0">One-click access — no password needed / Acceso sin contraseña</p>
    </div>
  </td></tr>
  <tr><td style="background:white;padding:8px 28px 28px;border-radius:0 0 16px 16px">
    <div style="border-top:1px solid #f3f4f6;padding-top:20px;text-align:center">
      <p style="color:#374151;font-size:14px;margin:0 0 4px"><strong>${agentName}</strong></p>
      <p style="color:#6b7280;font-size:13px;margin:0">${agentPhone} · Luxury Real Estate Miami</p>
    </div>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
            }).then(() => { emailsSent++ }).catch(() => {})
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
      emailsSent,
      skipped: parseSkipped + dupSkipped,
      errors: errors.slice(0, 10),
      total: lines.length - 1,
    })
  } catch (e: any) {
    console.error("Import error:", e)
    return NextResponse.json({ error: "Failed to process CSV" }, { status: 500 })
  }
}
