export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 min — allow time for sync + AI calls

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { fetchListings, bridgeToProperty } from "@/lib/bridge"
import { sendEmail } from "@/lib/email"
import { scoreProperty, scoreColor, scoreLabel } from "@/lib/property-scoring"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" })

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET || process.env.MLS_SYNC_SECRET
  if (!secret) return true // no secret configured — open (dev only)
  const header = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "")
  const url = new URL(req.url)
  const param = url.searchParams.get("secret")
  return header === secret || param === secret
}

// ─── Step 1: Sync fresh listings from Bridge API ──────────────────────────────

async function syncFreshListings(): Promise<{ created: number; updated: number }> {
  const cities = ["Miami", "Miami Beach", "Doral", "Kendall", "Coral Gables", "Aventura", "Sunny Isles Beach", "Hialeah", "Homestead"]
  let created = 0, updated = 0

  for (const city of cities) {
    try {
      const listings = await fetchListings({ city, limit: 50 })
      for (const listing of listings) {
        const data = bridgeToProperty(listing)
        if (!data.mlsId) continue
        try {
          const existing = await prisma.property.findFirst({ where: { mlsId: data.mlsId } })
          if (existing) {
            await prisma.property.update({ where: { id: existing.id }, data })
            updated++
          } else {
            await prisma.property.create({ data })
            created++
          }
        } catch { /* skip individual errors */ }
      }
    } catch (e) {
      console.error(`[match-alerts] Bridge sync error for ${city}:`, e)
    }
  }

  // Mark stale listings inactive
  await prisma.property.updateMany({
    where: { status: "ACTIVE", updatedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    data: { status: "INACTIVE" },
  })

  return { created, updated }
}

// ─── Step 2: AI explanations for a contact's top matches ─────────────────────

async function generateExplanations(
  matches: { property: { address: string; city: string; price: number; bedrooms: number | null; bathrooms: number | null }; score: number; reasons: string[] }[],
  prefs: { buyerBudgetMax?: number | null; buyerBedroomsMin?: number | null; buyerLocation?: string | null; buyerPropertyType?: string | null }
): Promise<string[]> {
  const prefSummary = [
    prefs.buyerBudgetMax ? `budget up to $${prefs.buyerBudgetMax.toLocaleString()}` : null,
    prefs.buyerBedroomsMin ? `${prefs.buyerBedroomsMin}+ bedrooms` : null,
    prefs.buyerLocation ? `in ${prefs.buyerLocation}` : null,
    prefs.buyerPropertyType ? prefs.buyerPropertyType.replace(/_/g, " ").toLowerCase() : null,
  ].filter(Boolean).join(", ")

  const prompt = `You are Sofia, a friendly real estate AI assistant for Catherine Gomez. Generate a warm 1-sentence explanation for why each property is a great match. Be specific and mention the key reason. Under 20 words each. Bilingual feel is fine.

Buyer wants: ${prefSummary || "a great home"}

Properties:
${matches.map((m, i) => `${i + 1}. ${m.property.address}, ${m.property.city} — $${m.property.price.toLocaleString()}, ${m.property.bedrooms ?? "?"}bd/${m.property.bathrooms ?? "?"}ba, ${m.score}% match, Reasons: ${m.reasons.join(", ")}`).join("\n")}

Respond ONLY with a JSON array of ${matches.length} strings. Example: ["explanation 1","explanation 2"]`

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    })
    const text = response.content[0].type === "text" ? response.content[0].text : ""
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed.map(String)
  } catch { /* fall back to empty */ }

  return matches.map(() => "")
}

// ─── Step 3: Build property alert email ──────────────────────────────────────

function buildAlertEmail(opts: {
  firstName: string
  matches: {
    property: {
      id: string; address: string; city: string; state: string
      price: number; bedrooms: number | null; bathrooms: number | null; sqft: number | null
      images: string | null
    }
    score: number
    reasons: string[]
    explanation: string
  }[]
  agentName: string
  agentPhone: string
  appUrl: string
}): string {
  const { firstName, matches, agentName, agentPhone, appUrl } = opts
  const n = matches.length

  function getImg(raw: string | null): string {
    try { const a = JSON.parse(raw || "[]"); return Array.isArray(a) && a[0] ? a[0] : "" } catch { return "" }
  }

  const propertyCards = matches.map(({ property: p, score, reasons, explanation }) => {
    const img = getImg(p.images)
    const color = scoreColor(score)
    const label = scoreLabel(score)
    const reasonChips = reasons.slice(0, 3).map(r =>
      `<span style="display:inline-block;background:#f0fdf4;color:#166534;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;margin:2px 3px 2px 0;border:1px solid #bbf7d0">✓ ${r}</span>`
    ).join("")

    return `
    <div style="border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;margin:0 0 20px">
      ${img ? `<img src="${img}" width="100%" height="200" style="display:block;object-fit:cover;height:200px" alt="${p.address}" />` : `<div style="background:#f3f4f6;height:140px;display:flex;align-items:center;justify-content:center"><span style="font-size:36px">🏠</span></div>`}
      <div style="padding:18px">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <p style="font-size:22px;font-weight:900;color:#059669;margin:0">${p.price.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</p>
            </td>
            <td align="right">
              <span style="background:${color};color:white;font-size:12px;font-weight:700;padding:5px 13px;border-radius:20px;white-space:nowrap">${score}% · ${label}</span>
            </td>
          </tr>
        </table>
        <p style="font-weight:700;color:#111827;margin:8px 0 2px;font-size:15px">${p.address}</p>
        <p style="color:#6b7280;font-size:13px;margin:0 0 10px">${p.city}, ${p.state}</p>
        <p style="color:#6b7280;font-size:13px;margin:0 0 10px">
          ${p.bedrooms ? `🛏 ${p.bedrooms} bd &nbsp;` : ""}${p.bathrooms ? `🚿 ${p.bathrooms} ba &nbsp;` : ""}${p.sqft ? `📐 ${p.sqft.toLocaleString()} sqft` : ""}
        </p>
        ${reasonChips ? `<div style="margin:0 0 12px">${reasonChips}</div>` : ""}
        ${explanation ? `
        <div style="background:#f5f3ff;border-left:3px solid #7c3aed;padding:10px 14px;border-radius:0 8px 8px 0;margin:0 0 14px">
          <p style="color:#5b21b6;font-size:13px;font-style:italic;margin:0">✨ ${explanation}</p>
        </div>` : ""}
        <a href="${appUrl}/portal/matches" style="display:inline-block;background:#0e1f3d;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px">
          Ver en Portal →
        </a>
      </div>
    </div>`
  }).join("")

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<div style="display:none;max-height:0;overflow:hidden">Sofia encontró ${n} nueva${n > 1 ? "s propiedades" : " propiedad"} que coincide${n > 1 ? "n" : ""} con lo que buscas — ¡mira!</div>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#0a1628 0%,#1a2f50 100%);border-radius:16px 16px 0 0;padding:32px;text-align:center">
    <p style="color:#c9a84c;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:0 0 8px">✨ SOFIA · AI Real Estate Assistant</p>
    <h1 style="color:white;font-size:26px;font-weight:900;margin:0 0 6px">
      ${n} New Match${n > 1 ? "es" : ""} Found!
    </h1>
    <p style="color:#8fa3c4;font-size:14px;margin:0">
      Sofia encontró ${n} propiedad${n > 1 ? "es" : ""} perfecta${n > 1 ? "s" : ""} para ti
    </p>
  </td></tr>

  <!-- Intro -->
  <tr><td style="background:white;padding:28px 28px 8px">
    <p style="color:#374151;font-size:15px;margin:0 0 6px">
      Hola <strong>${firstName}</strong>! 👋
    </p>
    <p style="color:#374151;font-size:14px;margin:0 0 4px">
      I scanned today's new listings and found <strong>${n} home${n > 1 ? "s" : ""} that match${n === 1 ? "es" : ""} your preferences</strong>. Here are your top picks:
    </p>
    <p style="color:#9ca3af;font-size:13px;margin:0">
      Analicé las nuevas propiedades y encontré las mejores opciones para ti.
    </p>
  </td></tr>

  <!-- Property cards -->
  <tr><td style="background:white;padding:12px 28px 4px">
    ${propertyCards}
  </td></tr>

  <!-- Footer CTA -->
  <tr><td style="background:white;padding:8px 28px 28px;border-radius:0 0 16px 16px">
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px;text-align:center">
      <p style="color:#374151;font-size:14px;margin:0 0 14px">¿No es lo que buscas? / Not quite right?</p>
      <a href="${appUrl}/portal/preferences" style="display:inline-block;background:white;border:2px solid #1a2f50;color:#1a2f50;padding:9px 18px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;margin:0 6px 8px">
        Update My Preferences
      </a>
      <a href="${appUrl}/portal/matches" style="display:inline-block;background:#1a2f50;color:white;padding:9px 18px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;margin:0 6px 8px">
        View All My Matches →
      </a>
    </div>
    <div style="text-align:center;margin-top:20px">
      <p style="color:#374151;font-size:14px;margin:0 0 4px"><strong>${agentName}</strong></p>
      <p style="color:#6b7280;font-size:13px;margin:0 0 12px">${agentPhone} · Luxury Real Estate Miami</p>
      <p style="color:#d1d5db;font-size:11px;margin:0">
        <a href="${appUrl}/portal/preferences" style="color:#d1d5db">Cancelar alertas / Unsubscribe</a>
      </p>
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

// ─── Main cron handler ────────────────────────────────────────────────────────

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const log: string[] = []
  let emailsSent = 0

  try {
    // 1. Sync fresh listings
    log.push("Syncing Bridge API listings...")
    const { created, updated } = await syncFreshListings()
    log.push(`Sync complete: ${created} new, ${updated} updated`)

    // 2. Get all active properties (fresh enough to send)
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000) // last 48h
    const freshProperties = await prisma.property.findMany({
      where: { status: "ACTIVE", createdAt: { gte: cutoff } },
      select: {
        id: true, address: true, city: true, state: true,
        price: true, bedrooms: true, bathrooms: true, sqft: true,
        propertyType: true, pool: true, garage: true, features: true,
        images: true, status: true,
      },
    })
    log.push(`Fresh properties (last 48h): ${freshProperties.length}`)

    if (freshProperties.length === 0) {
      return NextResponse.json({ success: true, log, emailsSent: 0 })
    }

    // 3. Get AI config for agent name/phone
    const aiConfig = await prisma.aIConfig.findFirst({
      select: { realtorName: true, realtorPhone: true, realtorEmail: true },
    })
    const agentName = aiConfig?.realtorName || "Catherine"
    const agentPhone = aiConfig?.realtorPhone || "305-283-0872"
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"

    // 4. Find all portal contacts with preferences + email
    const contacts = await prisma.contact.findMany({
      where: {
        matchPrefsCompletedAt: { not: null },
        email: { not: null },
        portalAccess: { isActive: true },
      },
      select: {
        id: true, firstName: true, email: true,
        buyerBudgetMin: true, buyerBudgetMax: true,
        buyerBedroomsMin: true, buyerBathroomsMin: true,
        buyerPropertyType: true, buyerMustHaves: true,
        buyerLocation: true,
      },
    })
    log.push(`Contacts with preferences + portal: ${contacts.length}`)

    // 5. Process each contact
    for (const contact of contacts) {
      try {
        // Score all fresh properties for this contact
        const prefs = {
          buyerBudgetMin: contact.buyerBudgetMin,
          buyerBudgetMax: contact.buyerBudgetMax,
          buyerBedroomsMin: contact.buyerBedroomsMin,
          buyerBathroomsMin: contact.buyerBathroomsMin,
          buyerPropertyType: contact.buyerPropertyType,
          buyerMustHaves: contact.buyerMustHaves,
          buyerLocation: contact.buyerLocation,
        }

        const scored = freshProperties
          .map(p => ({ property: p, ...scoreProperty(p, prefs) }))
          .filter(m => m.score >= 40)
          .sort((a, b) => b.score - a.score)

        if (scored.length === 0) continue

        // Remove already-sent properties
        const alreadySent = await prisma.propertyAlertSent.findMany({
          where: {
            contactId: contact.id,
            propertyId: { in: scored.map(m => m.property.id) },
          },
          select: { propertyId: true },
        })
        const sentIds = new Set(alreadySent.map(s => s.propertyId))
        const newMatches = scored.filter(m => !sentIds.has(m.property.id)).slice(0, 5)

        if (newMatches.length === 0) continue

        // Generate AI explanations
        const explanations = await generateExplanations(newMatches, prefs)

        const matchesWithExplanations = newMatches.map((m, i) => ({
          ...m,
          explanation: explanations[i] || "",
        }))

        // Build and send email
        const html = buildAlertEmail({
          firstName: contact.firstName,
          matches: matchesWithExplanations,
          agentName,
          agentPhone,
          appUrl,
        })

        await sendEmail({
          to: contact.email!,
          subject: `✨ Sofia found ${newMatches.length} new home${newMatches.length > 1 ? "s" : ""} perfect for you`,
          html,
          replyTo: aiConfig?.realtorEmail || undefined,
        })

        // Record sent properties
        await prisma.propertyAlertSent.createMany({
          data: newMatches.map(m => ({ contactId: contact.id, propertyId: m.property.id })),
          skipDuplicates: true,
        })

        // Notify Catherine about the alert sent
        await prisma.aINotification.create({
          data: {
            type: "MATCH_ALERT_SENT",
            title: `📧 Match alert sent to ${contact.firstName}`,
            body: `Sent ${newMatches.length} new match${newMatches.length > 1 ? "es" : ""} to ${contact.email}. Top match: ${newMatches[0].property.address} at ${newMatches[0].score}%`,
            priority: "MEDIUM",
            contactId: contact.id,
            metadata: JSON.stringify({ count: newMatches.length, topScore: newMatches[0].score }),
          },
        })

        emailsSent++
        log.push(`✓ Sent ${newMatches.length} matches to ${contact.firstName} (${contact.email})`)
      } catch (e) {
        log.push(`✗ Failed for ${contact.firstName}: ${(e as Error).message}`)
      }
    }

    log.push(`Done. Emails sent: ${emailsSent}`)
    return NextResponse.json({ success: true, created, updated: updated, emailsSent, log })

  } catch (e) {
    console.error("[match-alerts cron] Fatal error:", e)
    return NextResponse.json({ error: (e as Error).message, log }, { status: 500 })
  }
}
