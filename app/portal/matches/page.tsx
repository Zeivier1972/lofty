export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { getPortalContact } from "@/lib/portal-auth"
import PortalShell from "../_components/portal-shell"
import MatchesClient from "./matches-client"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"

interface Property {
  id: string
  address: string
  city: string
  state: string
  price: number
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  propertyType: string
  pool: boolean
  garage: number | null
  features: string | null
  images: string | null
  status: string
}

interface Prefs {
  buyerBudgetMin: number | null
  buyerBudgetMax: number | null
  buyerBedroomsMin: number | null
  buyerBathroomsMin: number | null
  buyerPropertyType: string | null
  buyerMustHaves: string | null
  buyerLocation: string | null
  matchPrefsCompletedAt: Date | null
}

function scoreProperty(p: Property, prefs: Prefs): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []

  // Budget (25 pts)
  const hasBudget = prefs.buyerBudgetMin != null || prefs.buyerBudgetMax != null
  if (hasBudget) {
    const min = prefs.buyerBudgetMin ?? 0
    const max = prefs.buyerBudgetMax ?? Infinity
    if (p.price >= min && p.price <= max) {
      score += 25
      reasons.push("Fits your budget")
    } else if (p.price > max) {
      const overage = (p.price - max) / max
      if (overage <= 0.1) { score += 15; reasons.push("Slightly above budget") }
      else if (overage <= 0.25) { score += 5 }
    } else {
      score += 15
      reasons.push("Below your max budget")
    }
  } else {
    score += 25
  }

  // Bedrooms (20 pts)
  if (prefs.buyerBedroomsMin != null && p.bedrooms != null) {
    if (p.bedrooms >= prefs.buyerBedroomsMin) {
      score += 20
      if (prefs.buyerBedroomsMin > 1) reasons.push(`${p.bedrooms} bedrooms`)
    } else if (p.bedrooms === prefs.buyerBedroomsMin - 1) {
      score += 10
    }
  } else {
    score += 20
  }

  // Bathrooms (10 pts)
  if (prefs.buyerBathroomsMin != null && p.bathrooms != null) {
    if (p.bathrooms >= prefs.buyerBathroomsMin) {
      score += 10
    } else if (p.bathrooms >= prefs.buyerBathroomsMin - 0.5) {
      score += 5
    }
  } else {
    score += 10
  }

  // Location (20 pts)
  if (prefs.buyerLocation) {
    const locLow = prefs.buyerLocation.toLowerCase()
    const cityLow = p.city.toLowerCase()
    const addrLow = p.address.toLowerCase()
    if (cityLow.includes(locLow) || locLow.includes(cityLow) || addrLow.includes(locLow)) {
      score += 20
      reasons.push(`In ${p.city}`)
    } else {
      score += 3
    }
  } else {
    score += 20
  }

  // Property Type (15 pts)
  if (prefs.buyerPropertyType && p.propertyType) {
    const norm = (s: string) => s.toLowerCase().replace(/[_\s]/g, "")
    if (norm(p.propertyType) === norm(prefs.buyerPropertyType)) {
      score += 15
      reasons.push(p.propertyType.replace(/_/g, " ").toLowerCase())
    } else {
      score += 3
    }
  } else {
    score += 15
  }

  // Must-haves (10 pts max, 2 pts each)
  let mustHaves: string[] = []
  try { mustHaves = JSON.parse(prefs.buyerMustHaves || "[]") } catch {}

  if (mustHaves.length > 0) {
    let featureLow = ""
    try { featureLow = JSON.parse(p.features || "[]").join(" ").toLowerCase() } catch {}

    let mhScore = 0
    const matched: string[] = []
    for (const mh of mustHaves) {
      const mhL = mh.toLowerCase()
      let has = false
      if (mhL === "pool") has = p.pool
      else if (mhL === "garage") has = (p.garage ?? 0) > 0
      else has = featureLow.includes(mhL.replace(/_/g, " "))
      if (has) { mhScore += 2; matched.push(mh.replace(/_/g, " ")) }
    }
    score += Math.min(mhScore, 10)
    if (matched.length > 0) reasons.push(`Has: ${matched.join(", ")}`)
  } else {
    score += 10
  }

  return { score: Math.min(score, 100), reasons }
}

async function generateExplanations(
  matches: { property: Property; score: number; reasons: string[] }[],
  prefs: Prefs
): Promise<string[]> {
  const top = matches.slice(0, 5)
  if (top.length === 0) return []

  const prefSummary = [
    prefs.buyerBudgetMax ? `budget up to $${prefs.buyerBudgetMax.toLocaleString()}` : null,
    prefs.buyerBedroomsMin ? `${prefs.buyerBedroomsMin}+ bedrooms` : null,
    prefs.buyerLocation ? `in ${prefs.buyerLocation}` : null,
    prefs.buyerPropertyType ? prefs.buyerPropertyType.replace(/_/g, " ").toLowerCase() : null,
  ].filter(Boolean).join(", ")

  const prompt = `You are Sofia, a friendly real estate AI assistant. Generate a short 1-sentence personalized explanation for why each property is a great match for this buyer. Be warm, specific, and mention what makes it stand out for them. Keep each explanation under 20 words.

Buyer wants: ${prefSummary || "general residential property"}

Properties:
${top.map((m, i) => `${i + 1}. ${m.property.address}, ${m.property.city} — $${m.property.price.toLocaleString()}, ${m.property.bedrooms ?? "?"}bd/${m.property.bathrooms ?? "?"}ba, Match: ${m.score}%, Reasons: ${m.reasons.join(", ")}`).join("\n")}

Respond ONLY with a JSON array of ${top.length} strings, one per property, in order. Example: ["explanation 1", "explanation 2"]`

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" })
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    })
    const text = response.content[0].type === "text" ? response.content[0].text : ""
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed.map(String)
  } catch {
    // Silently fall back to empty — reasons already shown
  }

  return top.map(() => "")
}

export default async function MatchesPage() {
  const contact = await getPortalContact()
  if (!contact) redirect("/portal/login")

  const unread = contact.portalMessages.filter(m => !m.fromClient && !m.isRead).length

  const prefs = await prisma.contact.findUnique({
    where: { id: contact.id },
    select: {
      buyerBudgetMin: true,
      buyerBudgetMax: true,
      buyerBedroomsMin: true,
      buyerBathroomsMin: true,
      buyerPropertyType: true,
      buyerMustHaves: true,
      buyerLocation: true,
      matchPrefsCompletedAt: true,
    },
  })

  const hasPrefs = prefs?.matchPrefsCompletedAt != null

  const properties = await prisma.property.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true, address: true, city: true, state: true,
      price: true, bedrooms: true, bathrooms: true, sqft: true,
      propertyType: true, pool: true, garage: true, features: true,
      images: true, status: true,
    },
  })

  const savedIds = new Set(contact.propertySaves.map(s => s.property.id))

  const scored = properties
    .map(p => ({
      property: p,
      ...scoreProperty(p, prefs || {
        buyerBudgetMin: null, buyerBudgetMax: null,
        buyerBedroomsMin: null, buyerBathroomsMin: null,
        buyerPropertyType: null, buyerMustHaves: null,
        buyerLocation: null, matchPrefsCompletedAt: null,
      }),
      saved: savedIds.has(p.id),
    }))
    .sort((a, b) => b.score - a.score)

  let aiExplanations: string[] = []
  if (hasPrefs && scored.length > 0) {
    aiExplanations = await generateExplanations(scored, prefs!)
  }

  const matches = scored.map((m, i) => ({
    ...m,
    aiExplanation: aiExplanations[i] || "",
  }))

  return (
    <PortalShell
      contact={{ firstName: contact.firstName, lastName: contact.lastName, email: contact.email }}
      unreadMessages={unread}
    >
      <MatchesClient
        matches={matches}
        hasPrefs={hasPrefs}
        firstName={contact.firstName}
      />
    </PortalShell>
  )
}
