// Immediately send property match alert for a single contact.
// Called after lead creation/update with buyer prefs, or after Sofia extracts prefs from notes.

import { prisma } from "@/lib/prisma"
import { searchIdxListings, fetchPrimaryPhotos, buildDisplayAddress } from "@/lib/bridge"
import { sendEmail, proxiedImage } from "@/lib/email"
import Anthropic from "@anthropic-ai/sdk"

// Map CRM buyerPropertyType enum → Bridge MLS PropertySubType string
const PROP_TYPE_MAP: Record<string, string> = {
  SINGLE_FAMILY: "Single Family Residence",
  CONDO: "Condominium",
  TOWNHOUSE: "Townhouse",
  MULTI_FAMILY: "Multi Family",
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"

interface AlertProperty {
  photo: string | null
  price: number | null
  address: string
  city: string | null
  beds: number | null
  baths: number | null
  sqft: number | null
  url: string
}

function buildAlertEmail(opts: {
  firstName: string
  count: number
  criteriaSummary: string
  agentName: string
  agentPhone: string
  searchUrl: string
  properties: AlertProperty[]
}): string {
  const { firstName, count: n, criteriaSummary, agentName, agentPhone, searchUrl, properties } = opts
  const criteriaLine = criteriaSummary
    ? `<p style="color:#6b7280;font-size:13px;margin:0 0 20px">Based on your search: <em>${criteriaSummary}</em></p>`
    : ""

  const priceStr = (p: number | null) =>
    p == null ? "" : (p >= 1_000_000 ? `$${(p / 1_000_000).toFixed(p % 1_000_000 === 0 ? 0 : 1)}M` : `$${p.toLocaleString()}`)

  // Inline property cards — photo + price + specs + a link to the full listing.
  // This is what makes the email convert: the client sees the homes, not just a count.
  const cards = properties.map(pr => {
    const specs = [
      pr.beds != null ? `${pr.beds} bd` : "",
      pr.baths != null ? `${pr.baths} ba` : "",
      pr.sqft != null ? `${pr.sqft.toLocaleString()} sqft` : "",
    ].filter(Boolean).join(" · ")
    const loc = [pr.city].filter(Boolean).join(", ")
    return `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        <tr><td>
          <a href="${pr.url}" target="_blank" style="text-decoration:none;color:inherit">
            <img src="${proxiedImage(pr.photo)}" alt="Propiedad" width="580" style="width:100%;max-width:580px;height:200px;object-fit:cover;display:block"/>
            <div style="padding:16px">
              ${pr.price != null ? `<p style="font-size:22px;font-weight:800;color:#059669;margin:0 0 4px">${priceStr(pr.price)}</p>` : ""}
              <p style="font-weight:700;color:#111827;font-size:15px;margin:0 0 2px">${pr.address}</p>
              ${loc ? `<p style="color:#6b7280;font-size:13px;margin:0 0 6px">${loc}</p>` : ""}
              ${specs ? `<p style="color:#6b7280;font-size:13px;margin:0 0 10px">${specs}</p>` : ""}
              <span style="display:inline-block;background:#0e1f3d;color:#fff;padding:9px 18px;border-radius:8px;font-size:13px;font-weight:700">Ver fotos y detalles →</span>
            </div>
          </a>
        </td></tr>
      </table>`
  }).join("")

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
  <tr><td style="background:white;padding:24px 20px">
    <p style="color:#374151;font-size:15px;margin:0 0 12px">Hi <strong>${firstName}</strong>!</p>
    <p style="color:#374151;font-size:14px;margin:0 0 16px">
      I'm Sofía, ${agentName}'s AI assistant. Here are the newest listings that match your search — tap any home to see all the photos and details:
    </p>
    ${criteriaLine}
    ${cards}
    <div style="text-align:center;margin:8px 0 24px">
      <a href="${searchUrl}" style="display:inline-block;background:#0e1f3d;color:white;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
        Ver todas mis propiedades →
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

    // Parse buyerLocation into zip codes and/or city names — ALL of them are
    // used (OR'd together), so "33032, 33034, Homestead" matches any area.
    const rawLoc = (prefs.buyerLocation || "").trim()
    const locTokens = rawLoc ? rawLoc.split(",").map((s: string) => s.trim()).filter(Boolean) : []
    const ZIP_RE = /^\d{5}$/
    const zipTokens = locTokens.filter((l: string) => ZIP_RE.test(l))
    const cityTokens = locTokens.filter((l: string) => !ZIP_RE.test(l))

    // buyerPropertyType can hold MULTIPLE comma-separated types
    // (e.g. "SINGLE_FAMILY,TOWNHOUSE") — map each to its MLS subtype
    const propSubTypes = (prefs.buyerPropertyType || "")
      .split(",")
      .map(t => PROP_TYPE_MAP[t.trim()])
      .filter(Boolean)

    // Query live Bridge MLS with buyer's criteria
    const mlsListings = await searchIdxListings({
      zips: zipTokens.length > 0 ? zipTokens : undefined,
      cities: cityTokens.length > 0 ? cityTokens : undefined,
      minPrice: prefs.buyerBudgetMin || undefined,
      maxPrice: prefs.buyerBudgetMax || undefined,
      minBeds: prefs.buyerBedroomsMin || undefined,
      minBaths: prefs.buyerBathroomsMin || undefined,
      propertySubTypes: propSubTypes.length > 0 ? propSubTypes : undefined,
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

    // Send email — only proceed to dedup/success if it ACTUALLY delivered.
    const delivered = await sendEmail({
      to: contact.email,
      subject: `✨ Sofia found ${newMatches.length} home${newMatches.length > 1 ? "s" : ""} perfect for you`,
      html: buildAlertEmail({
        firstName: contact.firstName,
        count: newMatches.length,
        criteriaSummary,
        agentName,
        agentPhone,
        searchUrl,
        properties: newMatches.map((l: any) => ({
          photo: photoMap[l.ListingKey] || null,
          price: l.ListPrice ?? null,
          address: buildDisplayAddress(l),
          city: l.City ?? null,
          beds: l.BedroomsTotal ?? null,
          baths: l.BathroomsTotalDecimal ?? null,
          sqft: l.LivingArea ?? null,
          url: `${APP_URL}/homes/${encodeURIComponent(l.ListingKey)}`,
        })),
      }),
    })
    if (!delivered) {
      // Do NOT mark as sent — leave them eligible for retry next run.
      return { sent: false, reason: "Email not delivered (provider rejected — check Resend domain verification)" }
    }

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

// Build an SMS/WhatsApp reply listing the actual matching MLS resale properties.
// Returns null if nothing matched. Address/price/beds are safe to show for resale.
export async function buildListingsReply(prefs: {
  buyerLocation?: string | null
  buyerBudgetMin?: number | null
  buyerBudgetMax?: number | null
  buyerBedroomsMin?: number | null
  buyerBathroomsMin?: number | null
  buyerPropertyType?: string | null
}, appUrl: string): Promise<string | null> {
  const loc = (prefs.buyerLocation || "").trim()
  const tokens = loc ? loc.split(",").map(s => s.trim()).filter(Boolean) : []
  const zips = tokens.filter(t => /^\d{5}$/.test(t))
  const cities = tokens.filter(t => !/^\d{5}$/.test(t))
  try {
    const listings = await searchIdxListings({
      zips: zips.length ? zips : undefined,
      cities: cities.length ? cities : undefined,
      minPrice: prefs.buyerBudgetMin || undefined,
      maxPrice: prefs.buyerBudgetMax || undefined,
      minBeds: prefs.buyerBedroomsMin || undefined,
      minBaths: prefs.buyerBathroomsMin || undefined,
      propertySubType: prefs.buyerPropertyType ? PROP_TYPE_MAP[prefs.buyerPropertyType] : undefined,
      limit: 4,
    })
    if (!listings.length) return null
    // IDX-safe over SMS: city, price, specs, MLS# — NO street address.
    const lines = listings.slice(0, 4).map((l: any) => {
      const price = l.ListPrice ? `$${Number(l.ListPrice).toLocaleString()}` : ""
      const specs = [l.BedroomsTotal ? `${l.BedroomsTotal}bd` : "", l.BathroomsTotalDecimal ? `${l.BathroomsTotalDecimal}ba` : ""].filter(Boolean).join("/")
      const mls = l.ListingId ? `MLS# ${l.ListingId}` : ""
      return `• ${l.City || "Miami"}, FL — ${[price, specs, mls].filter(Boolean).join(", ")}`
    })
    return `¡Encontré ${listings.length} opciones que coinciden! 🏠\n\n${lines.join("\n")}\n\nDirección y detalles completos aquí: ${appUrl}/homes`
  } catch {
    return null
  }
}
