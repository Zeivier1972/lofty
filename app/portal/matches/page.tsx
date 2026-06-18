export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { getPortalContact } from "@/lib/portal-auth"
import PortalShell from "../_components/portal-shell"
import MatchesClient from "./matches-client"
import { prisma } from "@/lib/prisma"
import { scoreProperty } from "@/lib/property-scoring"
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
