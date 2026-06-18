export interface PropertyForScoring {
  price: number
  bedrooms: number | null
  bathrooms: number | null
  propertyType: string
  city: string
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
