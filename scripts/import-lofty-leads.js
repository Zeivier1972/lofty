// Import all Lofty leads from CSV export
// Run: node scripts/import-lofty-leads.js [path-to-csv]
// Default CSV path is the uploaded file location

const { PrismaClient } = require("@prisma/client")
const fs = require("fs")
const path = require("path")

const prisma = new PrismaClient()

const CSV_PATH = process.argv[2] ||
  "/root/.claude/uploads/1227af75-efd7-5df9-ae94-ed3a84826247/d6f1380a-LoftyLead_07032026_jDpS4r10gKvFTzCA.csv"

// --- CSV parser (handles quoted fields and embedded commas) ---
function parseCSV(content) {
  const lines = content.split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = parseCSVRow(lines[0])
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const vals = parseCSVRow(lines[i])
    const row = {}
    headers.forEach((h, idx) => { row[h.trim()] = (vals[idx] || "").trim() })
    rows.push(row)
  }
  return rows
}

function parseCSVRow(line) {
  const result = []
  let cur = "", inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      result.push(cur); cur = ""
    } else {
      cur += ch
    }
  }
  result.push(cur)
  return result
}

// --- Field helpers ---
function cleanStr(s) { return (s || "").trim().replace(/^`+|`+$/g, "") }

function parsePrice(s) {
  if (!s) return null
  const n = Number(s.replace(/[$,\s]/g, ""))
  return isNaN(n) || n === 0 ? null : n
}

function parsePhone(s) {
  if (!s) return null
  const d = s.replace(/\D/g, "")
  if (d.length === 10) return d
  if (d.length === 11 && d[0] === "1") return d.slice(1)
  if (d.length >= 7) return d
  return null
}

function parseZipPrefs(s) {
  // Format: 33032|"33034"|"33035"|"33158" or similar
  if (!s) return []
  return [...new Set(
    s.split(/[|,]/)
      .map(z => z.replace(/["\s`]/g, "").trim())
      .filter(z => /^\d{5}$/.test(z))
  )]
}

function parseTags(s) {
  if (!s) return []
  return [...new Set(
    s.split("|").map(t => t.trim()).filter(Boolean)
  )]
}

function buildBuyerLocation(row) {
  const zips = parseZipPrefs(row["ZipCode(Preference)"])
  const city = cleanStr(row["City(Preference)"])
  const parts = []
  if (zips.length > 0) parts.push(...zips)
  if (city && city !== "All" && city.length > 1) parts.push(city)
  return parts.length > 0 ? parts.join(", ") : null
}

function parseRegDate(row) {
  const d = cleanStr(row["Reg Date"])
  if (!d) return null
  try { return new Date(d) } catch { return null }
}

// --- Main import ---
async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error("CSV not found at:", CSV_PATH)
    process.exit(1)
  }

  const content = fs.readFileSync(CSV_PATH, "utf-8")
  const rows = parseCSV(content)
  console.log(`Parsed ${rows.length} rows from CSV`)

  // Load first agent user (Catherine) as note author
  const agentUser = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } })
  const agentUserId = agentUser?.id || null

  // Pre-load all existing emails and loftyIds for dedup
  const existingByEmail = new Map()
  const existingByLoftyId = new Map()
  const allContacts = await prisma.contact.findMany({ select: { id: true, email: true, customFields: true } })
  for (const c of allContacts) {
    if (c.email) existingByEmail.set(c.email.toLowerCase().trim(), c.id)
    if (c.customFields) {
      try {
        const cf = JSON.parse(c.customFields)
        if (cf.loftyId) existingByLoftyId.set(String(cf.loftyId), c.id)
      } catch {}
    }
  }
  console.log(`Found ${existingByEmail.size} existing contacts by email, ${existingByLoftyId.size} by loftyId`)

  // Tag cache
  const tagCache = new Map()
  async function getOrCreateTag(name) {
    const key = name.toLowerCase()
    if (tagCache.has(key)) return tagCache.get(key)
    const tag = await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name, color: "#6366f1" },
    })
    tagCache.set(key, tag.id)
    return tag.id
  }

  let created = 0, updated = 0, skipped = 0, errors = 0
  const BATCH = 50

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    for (const row of batch) {
      try {
        const loftyId = cleanStr(row["Lead Id"])
        const firstName = cleanStr(row["First Name"]) || "Unknown"
        const lastName = cleanStr(row["Last Name"]) || ""
        const email = cleanStr(row["Primary Email"]).toLowerCase() || null
        const phone = parsePhone(cleanStr(row["Primary Phone"]))
        const source = cleanStr(row["Source"]) || "Lofty Import"
        const pipeline = cleanStr(row["Pipeline"])
        const segment = cleanStr(row["Segment"])
        const language = cleanStr(row["Language"])

        // Buyer prefs
        const buyerBudgetMin = parsePrice(row["Min Price(Preference)"])
        const buyerBudgetMax = parsePrice(row["Max Price(Preference)"])
        const buyerLocation = buildBuyerLocation(row)
        const hasPrefs = !!(buyerBudgetMax || buyerBudgetMin || buyerLocation)

        // Mailing address
        const address = cleanStr(row["Street Address(Mailing  Address)"]) || null
        const city = cleanStr(row["City(Mailing Address)"]) || null
        const state = cleanStr(row["State(Mailing Address)"]) || null
        const zip = cleanStr(row["ZipCode(Mailing Address)"]) || null

        const customFields = JSON.stringify({
          loftyId: loftyId || undefined,
          pipeline: pipeline || undefined,
          segment: segment || undefined,
          language: language || undefined,
          leadScore: cleanStr(row["Custom Field-Lead Score"]) || undefined,
          smsSubscription: cleanStr(row["Custom Field-SMS Subscription"]) || undefined,
          whatsapp: cleanStr(row["Custom Field-WhatsApp"]) || undefined,
        })

        const regDate = parseRegDate(row)

        // Find existing contact
        let existingId = null
        if (loftyId && existingByLoftyId.has(loftyId)) existingId = existingByLoftyId.get(loftyId)
        else if (email && existingByEmail.has(email)) existingId = existingByEmail.get(email)

        const contactData = {
          firstName,
          lastName,
          ...(email && { email }),
          ...(phone && { phone }),
          source,
          address,
          city,
          state,
          zip,
          buyerBudgetMin,
          buyerBudgetMax,
          buyerLocation,
          ...(hasPrefs && { matchPrefsCompletedAt: new Date() }),
          customFields,
          ...(regDate && { createdAt: regDate }),
        }

        let contactId
        if (existingId) {
          // Update existing — don't overwrite prefs if they're already set
          const existing = await prisma.contact.findUnique({
            where: { id: existingId },
            select: { buyerBudgetMax: true, buyerLocation: true, matchPrefsCompletedAt: true }
          })
          const updateData = { ...contactData }
          // Don't overwrite existing prefs with nulls
          if (existing?.buyerBudgetMax && !updateData.buyerBudgetMax) delete updateData.buyerBudgetMax
          if (existing?.buyerLocation && !updateData.buyerLocation) delete updateData.buyerLocation
          if (existing?.matchPrefsCompletedAt) delete updateData.matchPrefsCompletedAt
          await prisma.contact.update({ where: { id: existingId }, data: updateData })
          contactId = existingId
          updated++
        } else {
          const created_ = await prisma.contact.create({ data: contactData })
          contactId = created_.id
          if (email) existingByEmail.set(email, contactId)
          if (loftyId) existingByLoftyId.set(loftyId, contactId)
          created++
        }

        // Tags (from Tag column + Pipeline as tag)
        const tagNames = parseTags(row["Tag"])
        if (pipeline) tagNames.push(pipeline)
        if (segment) tagNames.push(segment)

        for (const tagName of tagNames) {
          if (!tagName || tagName.length > 100) continue
          try {
            const tagId = await getOrCreateTag(tagName)
            await prisma.contactTag.upsert({
              where: { contactId_tagId: { contactId, tagId } },
              update: {},
              create: { contactId, tagId },
            })
          } catch {}
        }

        // Notes from Note 1-10 columns
        for (let n = 1; n <= 10; n++) {
          const noteContent = cleanStr(row[`Note ${n}`])
          if (!noteContent || noteContent.length < 3) continue
          // Check if this exact note already exists (avoid duplication on re-import)
          const existingNote = await prisma.note.findFirst({
            where: { contactId, content: noteContent },
          })
          if (!existingNote) {
            await prisma.note.create({
              data: {
                contactId,
                content: noteContent,
                authorId: agentUserId,
              },
            })
          }
        }

      } catch (e) {
        errors++
        if (errors <= 10) console.error(`Error on row ${i}: ${e.message}`)
      }
    }
    const done = Math.min(i + BATCH, rows.length)
    process.stdout.write(`\r  Progress: ${done}/${rows.length} (${created} new, ${updated} updated, ${errors} errors)`)
  }

  console.log(`\n\nDone!`)
  console.log(`  Created: ${created}`)
  console.log(`  Updated: ${updated}`)
  console.log(`  Errors:  ${errors}`)
  console.log(`  Total processed: ${rows.length}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
