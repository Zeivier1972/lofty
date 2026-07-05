// Immediately send property match alert for a single contact.
// Called after lead creation/update with buyer prefs, or after Sofia extracts prefs from notes.

import { prisma } from "@/lib/prisma"
import { searchIdxListings, fetchPrimaryPhotos, buildDisplayAddress } from "@/lib/bridge"
import { sendEmail } from "@/lib/email"
import Anthropic from "@anthropic-ai/sdk"

// Map CRM buyerPropertyType enum → Bridge MLS PropertySubType string
const PROP_TYPE_MAP: Record<string, string> = {
  SINGLE_FAMILY: "Single Family Residence",
  CONDO: "Condominium",
  TOWNHOUSE: "Townhouse",
  MULTI_FAMILY: "Multi Family",
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"

function buildAlertEmail(opts: {
  firstName: string
  count: number
  criteriaSummary: string
  agentName: string
  agentPhone: string
  searchUrl: string
}): string {
  const { firstName, count: n, criteriaSummary, agentName, agentPhone, searchUrl } = opts
  const criteriaLine = criteriaSummary
    ? `<p style="color:#6b7280;font-size:13px;margin:0 0 20px">Based on your search: <em>${criteriaSummary}</em></p>`
    : ""
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%">
  <tr><td style="background:linear-gradient(135deg,#0a1628 0%,#1a2f50 100%);border-radius:16px 16px 0 0;padding:32px;text-align:center">
    <p style="color:#c9a84c;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:0 0 8px">✨ SOFIA · AI Real Estate Assistant</p>
    <h1 style="color:white;font-size:26px;font-weight:900;margin:0 0 6px">
      ${n} home${n > 1 ? "s" : ""} match${n === 1 ? "es" : ""} what you're looking for!
    </h1>
    <p style="color:#8fa3c4;font-size:14px;margin:0">New listings perfect for you just arrived 🏡</p>
  </td></tr>
  <tr><td style="background:white;padding:28px">
    <p style="color:#374151;font-size:15px;margin:0 0 12px">Hi <strong>${firstName}</strong>!</p>
    <p style="color:#374151;font-size:14px;margin:0 0 16px">
      I'm Sofía, ${agentName}'s AI assistant. I found <strong>${n} new listing${n > 1 ? "s" : ""}</strong> that
      match${n === 1 ? "es" : ""} your search criteria — don't miss out, the best homes go fast!
    </p>
    ${criteriaLine}
    <div style="text-align:center;margin:0 0 24px">
      <a href="${searchUrl}" style="display:inline-block;background:#0e1f3d;color:white;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
        Ver las propiedades →
      </a>
    </div>
    <div style="border-top:1px solid #f3f4f6;padding-top:20px;text-align:center">
      <p style="color:#374151;font-size:14px;margin:0 0 4px"><strong>${agentName}</strong></p>
      <p style="color:#6b7280;font-size:13px;margin:0">${agentPhone} · Luxury Real Estate Miami</p>
    </div>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`
}

export async function triggerMatchAlert(contactId: string): Promise<{ sent: boolean; reason?: string }> {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: { portalAccess: true, portalMessages: { select: { id: true } } },
    })
    if (!contact) return { sent: false, reason: "Contact not found" }
    if (!contact.email) return { sent: false, reason: "No email" }
    if (contact.doNotEmail) return { sent: false, reason: "doNotEmail" }

    const prefs = {
      buyerBudgetMin: contact.buyerBudgetMin,
      buyerBudgetMax: contact.buyerBudgetMax,
      buyerBedroomsMin: contact.buyerBedroomsMin,
      buyerBathroomsMin: contact.buyerBathroomsMin,
      buyerPropertyType: contact.buyerPropertyType,
      buyerMustHaves: contact.buyerMustHaves,
      buyerLocation: contact.buyerLocation,
      matchPrefsCompletedAt: contact.matchPrefsCompletedAt,
    }

    if (!prefs.buyerBudgetMax && !prefs.buyerLocation && !prefs.buyerBedroomsMin) {
      return { sent: false, reason: "No buyer prefs" }
    }

    // Parse buyerLocation into zip codes and/or city names
    const rawLoc = (prefs.buyerLocation || "").trim()
    const locTokens = rawLoc ? rawLoc.split(",").map((s: string) => s.trim()).filter(Boolean) : []
    const ZIP_RE = /^\d{5}$/
    const zipTokens = locTokens.filter((l: string) => ZIP_RE.test(l))
    const cityTokens = locTokens.filter((l: string) => !ZIP_RE.test(l))
    // Prefer zip over city when both exist (zip is more specific)
    const primaryZip = zipTokens[0] || undefined
    const primaryCities = !primaryZip && cityTokens.length > 0 ? cityTokens : undefined

    const propSubType = prefs.buyerPropertyType
      ? PROP_TYPE_MAP[prefs.buyerPropertyType]
      : undefined

    // Query live Bridge MLS with buyer's criteria
    const mlsListings = await searchIdxListings({
      zip: primaryZip,
      cities: primaryCities,
      minPrice: prefs.buyerBudgetMin || undefined,
      maxPrice: prefs.buyerBudgetMax || undefined,
      minBeds: prefs.buyerBedroomsMin || undefined,
      minBaths: prefs.buyerBathroomsMin || undefined,
      propertySubType: propSubType,
      limit: 40,
    })

    // Fetch photos for MLS results
    const listingKeys = mlsListings.map((l: any) => l.ListingKey).filter(Boolean)
    const photoMap: Record<string, string> = listingKeys.length > 0
      ? await fetchPrimaryPhotos(listingKeys).catch(() => ({}))
      : {}

    // Dedup: skip listings already sent to this contact in the past 60 days (stored in Activity)
    const recentAlerts = await prisma.activity.findMany({
      where: {
        contactId,
        type: "PROPERTY_ALERT_SENT",
        createdAt: { gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
      },
      select: { metadata: true },
    })
    const sentListingKeys = new Set<string>(
      recentAlerts
        .map((a: { metadata: string | null }) => { try { return (JSON.parse(a.metadata || "{}") as any).listingKey as string } catch { return null } })
        .filter((k: string | null): k is string => !!k)
    )

    const newMatches = mlsListings
      .filter((l: any) => l.ListingKey && !sentListingKeys.has(l.ListingKey))
      .slice(0, 5)

    if (newMatches.length === 0) return { sent: false, reason: "No new matches" }

    // Build portal matches URL with magic link token so the click logs them in directly
    const portalToken = contact.portalAccess?.token
    const searchUrl = portalToken
      ? `${APP_URL}/portal/login?token=${portalToken}&next=/portal/matches`
      : `${APP_URL}/portal/matches`

    const criteriaSummary = [
      prefs.buyerLocation || null,
      prefs.buyerBedroomsMin ? `${prefs.buyerBedroomsMin}+ bedrooms` : null,
      prefs.buyerBudgetMax ? `up to $${prefs.buyerBudgetMax.toLocaleString()}` : null,
    ].filter(Boolean).join(" · ")

    const aiConfig = await prisma.aIConfig.findFirst({
      select: { realtorName: true, realtorPhone: true },
    }).catch(() => null)
    const agentName = aiConfig?.realtorName || "Catherine Gomez"
    const agentPhone = aiConfig?.realtorPhone || "305-283-0872"

    // Send email
    await sendEmail({
      to: contact.email,
      subject: `✨ Sofia found ${newMatches.length} home${newMatches.length > 1 ? "s" : ""} perfect for you`,
      html: buildAlertEmail({
        firstName: contact.firstName,
        count: newMatches.length,
        criteriaSummary,
        agentName,
        agentPhone,
        searchUrl,
      }),
    })

    // Record sent listings as Activity records for dedup (avoids schema dependency on local propertyId)
    await prisma.activity.createMany({
      data: newMatches.map((l: any) => ({
        contactId,
        type: "PROPERTY_ALERT_SENT",
        title: `Property alert sent: ${buildDisplayAddress(l)}`,
        metadata: JSON.stringify({
          listingKey: l.ListingKey,
          listingId: l.ListingId,
          address: buildDisplayAddress(l),
          price: l.ListPrice,
        }),
      })),
    })

    // Ensure portal access exists so they can log in
    if (!contact.portalAccess) {
      await prisma.clientPortalAccess.create({ data: { contactId } }).catch(() => {})
    }

    return { sent: true }
  } catch (e: any) {
    console.error("[triggerMatchAlert]", e?.message)
    return { sent: false, reason: e?.message }
  }
}

// Use Claude to extract buyer preferences from free-form note text.
// Returns partial Contact update data (only the fields found in the note).
export async function extractBuyerPrefsFromNote(noteText: string): Promise<{
  buyerBudgetMin?: number | null
  buyerBudgetMax?: number | null
  buyerBedroomsMin?: number | null
  buyerBathroomsMin?: number | null
  buyerLocation?: string | null
  buyerPropertyType?: string | null
  buyerMustHaves?: string | null
} | null> {
  if (!noteText || noteText.length < 10) return null

  const prompt = `Extract real estate buyer preferences from this agent note. Return ONLY a JSON object with these fields (omit fields not mentioned):
- buyerBudgetMin: number (minimum budget in dollars, no $ sign)
- buyerBudgetMax: number (maximum budget in dollars, no $ sign)
- buyerBedroomsMin: number (minimum bedrooms)
- buyerBathroomsMin: number (minimum bathrooms)
- buyerLocation: string (city name(s) or zip code(s), comma-separated)
- buyerPropertyType: string (one of: SINGLE_FAMILY, CONDO, TOWNHOUSE, MULTI_FAMILY)
- buyerMustHaves: string (pool, garage, waterfront, etc.)

Note: "${noteText.slice(0, 800)}"

Return only the JSON object, nothing else. If no preferences are mentioned, return {}.`

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" })
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    })
    const text = response.content[0].type === "text" ? response.content[0].text.trim() : ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0])
    // Validate types
    const result: ReturnType<typeof extractBuyerPrefsFromNote> extends Promise<infer T> ? T : never = {}
    if (typeof parsed.buyerBudgetMin === "number") result.buyerBudgetMin = parsed.buyerBudgetMin
    if (typeof parsed.buyerBudgetMax === "number") result.buyerBudgetMax = parsed.buyerBudgetMax
    if (typeof parsed.buyerBedroomsMin === "number") result.buyerBedroomsMin = Math.round(parsed.buyerBedroomsMin)
    if (typeof parsed.buyerBathroomsMin === "number") result.buyerBathroomsMin = parsed.buyerBathroomsMin
    if (typeof parsed.buyerLocation === "string" && parsed.buyerLocation) result.buyerLocation = parsed.buyerLocation
    if (typeof parsed.buyerPropertyType === "string" && parsed.buyerPropertyType) result.buyerPropertyType = parsed.buyerPropertyType
    if (typeof parsed.buyerMustHaves === "string" && parsed.buyerMustHaves) result.buyerMustHaves = parsed.buyerMustHaves
    return Object.keys(result).length > 0 ? result : null
  } catch {
    return null
  }
}
