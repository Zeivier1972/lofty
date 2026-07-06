export interface PropertyForScoring {
  price: number
  bedrooms: number | null
  bathrooms: number | null
  propertyType: string
  city: string
  zip: string
  address: string
  pool: boolean
  garage: number | null
  features: string | null
}

export interface ContactPrefs {
  buyerBudgetMin: number | null
  buyerBudgetMax: number | null
  buyerBedroomsMin: number | null
  buyerBathroomsMin: number | null
  buyerPropertyType: string | null
  buyerMustHaves: string | null
  buyerLocation: string | null
}

export function scoreProperty(
  p: PropertyForScoring,
  prefs: ContactPrefs
): { score: number; reasons: string[] } {
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

  // Location (20 pts) — supports city names, zip codes, or comma-separated mix
  if (prefs.buyerLocation) {
    const parts = prefs.buyerLocation.split(/[,|]/).map(s => s.trim()).filter(Boolean)
    const zipParts = parts.filter(s => /^\d{5}$/.test(s))
    const cityParts = parts.filter(s => !/^\d{5}$/.test(s))
    let locationMatch = false
    // Zip code match
    if (zipParts.length > 0 && zipParts.includes(p.zip?.trim())) {
      locationMatch = true
    }
    // City/county match
    if (!locationMatch && cityParts.length > 0) {
      const cityLow = p.city.toLowerCase()
      const addrLow = p.address.toLowerCase()
      locationMatch = cityParts.some(part => {
        const pl = part.toLowerCase()
        return cityLow.includes(pl) || pl.includes(cityLow) || addrLow.includes(pl)
      })
    }
    if (locationMatch) {
      score += 20
      reasons.push(`In ${zipParts.length > 0 ? p.zip || p.city : p.city}`)
    } else {
      score += 3
    }
  } else {
    score += 20
  }

  // Property Type (15 pts) — supports comma-separated list e.g. "SINGLE_FAMILY,TOWNHOUSE"
  if (prefs.buyerPropertyType && p.propertyType) {
    const norm = (s: string) => s.toLowerCase().replace(/[_\s]/g, "")
    const preferredTypes = prefs.buyerPropertyType.split(",").map(t => norm(t.trim())).filter(Boolean)
    if (preferredTypes.length === 0 || preferredTypes.includes(norm(p.propertyType))) {
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

// Returns true if the property price is within acceptable range of the buyer's budget.
// More than 15% over max budget or more than 20% below min budget → hard exclude.
export function propertyMatchesBudget(
  price: number,
  budgetMin: number | null | undefined,
  budgetMax: number | null | undefined
): boolean {
  if (budgetMax != null && price > budgetMax * 1.15) return false
  if (budgetMin != null && price < budgetMin * 0.80) return false
  return true
}

// Returns true only if the property's location matches the buyer's location preference.
// Zip codes are matched exactly; city names are matched with contains logic.
// When no location preference is set, all properties pass.
export function propertyMatchesLocation(
  p: { city: string; zip: string; address: string },
  buyerLocation: string | null | undefined
): boolean {
  if (!buyerLocation) return true
  const parts = buyerLocation.split(/[,|]/).map(s => s.trim()).filter(Boolean)
  if (parts.length === 0) return true

  const zipParts = parts.filter(s => /^\d{5}$/.test(s))
  const cityParts = parts.filter(s => !/^\d{5}$/.test(s))

  if (zipParts.length > 0 && zipParts.includes((p.zip || "").trim())) return true

  if (cityParts.length > 0) {
    const cityLow = (p.city || "").toLowerCase()
    const addrLow = (p.address || "").toLowerCase()
    if (cityParts.some(part => {
      const pl = part.toLowerCase()
      return cityLow.includes(pl) || pl.includes(cityLow) || addrLow.includes(pl)
    })) return true
  }

  // If only zips were specified and none matched, exclude
  if (zipParts.length > 0 && cityParts.length === 0) return false
  // If only cities were specified and none matched, exclude
  if (cityParts.length > 0 && zipParts.length === 0) return false
  return false
}

export function scoreColor(score: number): string {
  if (score >= 80) return "#16a34a"
  if (score >= 60) return "#c9a84c"
  if (score >= 40) return "#2563eb"
  return "#9ca3af"
}

export function scoreLabel(score: number): string {
  if (score >= 80) return "Excellent Match"
  if (score >= 60) return "Great Match"
  if (score >= 40) return "Good Match"
  return "Partial Match"
}
