/**
 * ShowingNew scraper — fetches new construction communities from the agent's
 * ShowingNew page and returns anonymized, commission-safe data.
 *
 * Data stored: area, price range, beds, delivery, description, image, zipCode.
 * Data NEVER stored or shown to leads: builder name, community name, direct URL.
 */

export interface ScrapedCommunity {
  area: string
  city: string
  zipCode?: string
  priceMin?: number
  priceMax?: number
  bedrooms?: string
  deliveryDate?: string
  status?: string
  description?: string
  imageUrl?: string
  scrapedAt: string
}

const AGENT_URL = "https://www.showingnew.com/catherinegomez"

// FL cities to search — South + North Florida
const FL_CITIES = [
  "Miami FL",
  "Doral FL",
  "Kendall FL",
  "Homestead FL",
  "Hollywood FL",
  "Miramar FL",
  "Weston FL",
  "Aventura FL",
  "Miami Gardens FL",
  "Cutler Bay FL",
  "Palmetto Bay FL",
  "Coral Gables FL",
  "Hialeah FL",
  "North Miami FL",
  "Sunrise FL",
  "Davie FL",
  "Pembroke Pines FL",
  "Coral Springs FL",
  "Plantation FL",
  "Ft Lauderdale FL",
  "Fort Lauderdale FL",
  "Pompano Beach FL",
  "Deerfield Beach FL",
  "Hallandale FL",
  "Boca Raton FL",
  "Delray Beach FL",
  "Boynton Beach FL",
  "Lake Worth FL",
  "West Palm Beach FL",
  "Wellington FL",
  "Jupiter FL",
  "Palm Beach Gardens FL",
  "Greenacres FL",
  "Royal Palm Beach FL",
  "Tamarac FL",
  "Margate FL",
  "Coconut Creek FL",
  "Lauderhill FL",
]

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xhtml,application/json,*/*;q=0.9",
  "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
  "Cache-Control": "no-cache",
}

function parsePrice(s: string | undefined): number | undefined {
  if (!s) return undefined
  const n = parseFloat(s.replace(/[^0-9.]/g, ""))
  return isNaN(n) ? undefined : n
}

/** Extract communities from a __NEXT_DATA__ JSON blob (Next.js sites) */
function extractFromNextData(html: string): ScrapedCommunity[] | null {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match) return null
  try {
    const data = JSON.parse(match[1])
    // Walk the props tree looking for arrays that look like communities
    const text = JSON.stringify(data)
    if (!text.includes("community") && !text.includes("Community") && !text.includes("builder")) return null
    return extractCommunitiesFromJson(data)
  } catch {
    return null
  }
}

/** Recursively walk any JSON structure looking for community-like objects */
function extractCommunitiesFromJson(obj: any, depth = 0): ScrapedCommunity[] {
  if (depth > 10 || !obj) return []
  const results: ScrapedCommunity[] = []

  if (Array.isArray(obj)) {
    for (const item of obj) {
      results.push(...extractCommunitiesFromJson(item, depth + 1))
    }
    return results
  }

  if (typeof obj === "object") {
    // Check if this object looks like a community
    const keys = Object.keys(obj).map(k => k.toLowerCase())
    const looksLikeCommunity =
      (keys.includes("city") || keys.includes("address")) &&
      (keys.includes("price") || keys.includes("pricemin") || keys.includes("minprice") || keys.includes("startingprice")) &&
      !results.some(r => r.area === obj.city)

    if (looksLikeCommunity) {
      const community = parseCommunityObject(obj)
      if (community) results.push(community)
    } else {
      for (const val of Object.values(obj)) {
        results.push(...extractCommunitiesFromJson(val, depth + 1))
      }
    }
  }

  return results
}

function parseCommunityObject(obj: any): ScrapedCommunity | null {
  const city = obj.city || obj.City || obj.location || obj.Location || ""
  if (!city) return null

  const priceRaw = obj.price || obj.startingPrice || obj.startingprice || obj.priceMin || obj.minPrice
  const priceMaxRaw = obj.priceMax || obj.maxPrice || obj.toPrice

  return {
    area: `${city}, FL`,
    city: city.toString(),
    zipCode: obj.zipCode || obj.zip || obj.postalCode || undefined,
    priceMin: parsePrice(priceRaw?.toString()),
    priceMax: parsePrice(priceMaxRaw?.toString()),
    bedrooms: obj.bedrooms || obj.beds || obj.bedroomRange || undefined,
    deliveryDate: obj.deliveryDate || obj.completionDate || obj.expectedDelivery || undefined,
    status: obj.status || obj.phase || undefined,
    description: (obj.description || obj.shortDescription || obj.summary || "").toString().substring(0, 300) || undefined,
    imageUrl: obj.imageUrl || obj.image || obj.heroImage || obj.photo || undefined,
    scrapedAt: new Date().toISOString(),
  }
}

/** Try ShowingNew's likely API endpoints */
async function tryShowingNewApi(city: string): Promise<ScrapedCommunity[]> {
  const encodedCity = encodeURIComponent(city)
  const cityOnly = city.replace(" FL", "").replace(/ FL$/i, "")
  const encodedCityOnly = encodeURIComponent(cityOnly)

  const apiAttempts = [
    `https://www.showingnew.com/api/v1/communities?location=${encodedCity}`,
    `https://www.showingnew.com/api/communities?location=${encodedCity}`,
    `https://www.showingnew.com/api/v2/communities?city=${encodedCityOnly}&state=FL`,
    `https://www.showingnew.com/api/search?q=${encodedCity}`,
    `https://api.showingnew.com/v1/communities?location=${encodedCity}`,
    `https://api.showingnew.com/communities?city=${encodedCityOnly}&state=FL`,
  ]

  for (const url of apiAttempts) {
    try {
      const res = await fetch(url, {
        headers: { ...FETCH_HEADERS, Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) continue
      const ct = res.headers.get("content-type") || ""
      if (!ct.includes("json")) continue
      const data = await res.json()
      const communities = extractCommunitiesFromJson(data)
      if (communities.length > 0) {
        console.log(`[ShowingNew] API hit: ${url} → ${communities.length} communities`)
        return communities
      }
    } catch {}
  }
  return []
}

/** Fetch the agent's ShowingNew page and extract embedded community data */
async function fetchAgentPage(searchCity?: string): Promise<ScrapedCommunity[]> {
  const url = searchCity
    ? `${AGENT_URL}?search=${encodeURIComponent(searchCity)}`
    : AGENT_URL

  const urlVariants = [
    url,
    `${AGENT_URL}?city=${encodeURIComponent(searchCity?.replace(" FL", "") || "")}`,
    `${AGENT_URL}?location=${encodeURIComponent(searchCity || "")}`,
    `${AGENT_URL}?q=${encodeURIComponent(searchCity || "")}`,
    `${AGENT_URL}/homes?city=${encodeURIComponent(searchCity?.replace(" FL", "") || "")}&state=FL`,
  ]

  for (const u of urlVariants) {
    try {
      const res = await fetch(u, {
        headers: FETCH_HEADERS,
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) continue
      const html = await res.text()
      if (!html || html.length < 100) continue

      // Try __NEXT_DATA__ extraction
      const fromNext = extractFromNextData(html)
      if (fromNext && fromNext.length > 0) {
        console.log(`[ShowingNew] __NEXT_DATA__ from ${u} → ${fromNext.length} communities`)
        return fromNext
      }

      // Try extracting any inline JSON from script tags
      const scriptJsonPattern = /<script[^>]*>([\s\S]*?)<\/script>/g
      let scriptMatch: RegExpExecArray | null
      while ((scriptMatch = scriptJsonPattern.exec(html)) !== null) {
        const content = scriptMatch[1].trim()
        if (!content.startsWith("{") && !content.startsWith("[")) continue
        try {
          const parsed = JSON.parse(content)
          const communities = extractCommunitiesFromJson(parsed)
          if (communities.length > 0) {
            console.log(`[ShowingNew] Inline script JSON from ${u} → ${communities.length} communities`)
            return communities
          }
        } catch {}
      }

      // Try extracting window.__STATE__ or similar patterns
      const statePatterns = [
        /window\.__STATE__\s*=\s*({[\s\S]*?});/,
        /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/,
        /window\.__DATA__\s*=\s*({[\s\S]*?});/,
        /window\.initialData\s*=\s*({[\s\S]*?});/,
      ]
      for (const pattern of statePatterns) {
        const m = html.match(pattern)
        if (!m) continue
        try {
          const parsed = JSON.parse(m[1])
          const communities = extractCommunitiesFromJson(parsed)
          if (communities.length > 0) {
            console.log(`[ShowingNew] Window state from ${u} → ${communities.length} communities`)
            return communities
          }
        } catch {}
      }
    } catch (e) {
      console.warn(`[ShowingNew] Fetch failed for ${u}:`, e)
    }
  }
  return []
}

/** Main entry: scrape all FL cities and return deduplicated, anonymized communities */
export async function scrapeShowingNew(): Promise<{ communities: ScrapedCommunity[]; errors: string[]; strategy: string }> {
  const errors: string[] = []
  const allCommunities: ScrapedCommunity[] = []
  let strategy = "none"

  // First try: fetch the main agent page (may have all communities)
  try {
    const main = await fetchAgentPage()
    if (main.length > 0) {
      allCommunities.push(...main)
      strategy = "main-page"
    }
  } catch (e: any) {
    errors.push(`Main page: ${e?.message}`)
  }

  // Second try: if main page yielded nothing, try the API for each city
  if (allCommunities.length === 0) {
    for (const city of FL_CITIES) {
      try {
        const apiResults = await tryShowingNewApi(city)
        if (apiResults.length > 0) {
          allCommunities.push(...apiResults)
          strategy = "api-per-city"
        }
      } catch (e: any) {
        errors.push(`API ${city}: ${e?.message}`)
      }
    }
  }

  // Third try: search page for each city
  if (allCommunities.length === 0) {
    for (const city of FL_CITIES) {
      try {
        const pageResults = await fetchAgentPage(city)
        if (pageResults.length > 0) {
          allCommunities.push(...pageResults)
          strategy = "search-per-city"
        }
      } catch (e: any) {
        errors.push(`Search ${city}: ${e?.message}`)
      }
    }
  }

  // Deduplicate by area + priceMin
  const seen = new Set<string>()
  const deduped = allCommunities.filter(c => {
    const key = `${c.area}|${c.priceMin}|${c.bedrooms}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  console.log(`[ShowingNew] Scraped ${deduped.length} communities (strategy: ${strategy}, errors: ${errors.length})`)
  return { communities: deduped, errors, strategy }
}
