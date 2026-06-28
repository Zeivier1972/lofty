/**
 * ShowingNew scraper — fetches new construction communities from the agent's
 * ShowingNew page using a headless browser (Playwright + system Chromium).
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

// FL cities to search — South + North Florida (include "FL" in every query)
export const FL_SEARCH_TERMS = [
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
  "Royal Palm Beach FL",
  "Tamarac FL",
  "Margate FL",
  "Coconut Creek FL",
  "Lauderhill FL",
]

function parsePrice(s: string | undefined | null): number | undefined {
  if (!s) return undefined
  const n = parseFloat(s.replace(/[^0-9.]/g, ""))
  return isNaN(n) ? undefined : n
}

// Find the system Chromium path
function getChromiumPath(): string | undefined {
  // Railway/Nixpacks sets this env var
  if (process.env.SHOWINGNEW_CHROMIUM_PATH) return process.env.SHOWINGNEW_CHROMIUM_PATH
  // Common system paths
  const candidates = [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/snap/bin/chromium",
  ]
  const { execSync } = require("child_process")
  for (const p of candidates) {
    try {
      execSync(`test -f "${p}"`, { stdio: "ignore" })
      return p
    } catch {}
  }
  // Try which
  try {
    return execSync("which chromium chromium-browser google-chrome 2>/dev/null", { encoding: "utf8" }).trim().split("\n")[0]
  } catch {}
  return undefined
}

/** Extract all community data visible on the page using multiple selector strategies */
async function extractCommunitiesFromPage(page: any): Promise<ScrapedCommunity[]> {
  const communities: ScrapedCommunity[] = []

  // Strategy: intercept any JSON data loaded by the page (already done via response listener)
  // Strategy: parse the DOM for card-like elements

  const cards = await page.evaluate(() => {
    const results: any[] = []

    // Common card selector patterns for real estate sites
    const selectors = [
      "[class*='community']",
      "[class*='Community']",
      "[class*='listing']",
      "[class*='home-card']",
      "[class*='HomeCard']",
      "[class*='property-card']",
      "[class*='PropertyCard']",
      "[class*='card']",
      "article",
    ]

    for (const sel of selectors) {
      const elements = document.querySelectorAll(sel)
      if (elements.length < 2) continue // skip if only 1 match (might be wrapper)

      for (const el of Array.from(elements)) {
        const text = (el as HTMLElement).innerText || ""
        const html = (el as HTMLElement).innerHTML || ""

        // Must contain price-like data to be a community card
        if (!text.match(/\$[\d,]+/) && !text.match(/From\s+\$/) && !html.includes("price")) continue

        // Extract visible text fields
        const cityMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),?\s*FL/)
        const priceMatch = text.match(/\$\s*([\d,]+)/)
        const priceMaxMatch = text.match(/–\s*\$\s*([\d,]+)/)
        const bedsMatch = text.match(/(\d+)\s*(?:BD|Bed|BR|bed)/i)
        const imgEl = (el as HTMLElement).querySelector("img")
        const imgSrc = imgEl ? (imgEl.getAttribute("src") || imgEl.getAttribute("data-src")) : null

        if (!cityMatch && !priceMatch) continue

        results.push({
          city: cityMatch ? cityMatch[1] : "",
          priceRaw: priceMatch ? priceMatch[1].replace(/,/g, "") : null,
          priceMaxRaw: priceMaxMatch ? priceMaxMatch[1].replace(/,/g, "") : null,
          beds: bedsMatch ? bedsMatch[1] : null,
          imageUrl: imgSrc,
          fullText: text.substring(0, 300),
        })
      }
      if (results.length > 0) break // found cards with this selector, stop trying
    }

    return results
  }).catch(() => [])

  for (const card of cards) {
    if (!card.city && !card.priceRaw) continue
    communities.push({
      area: `${card.city || "South Florida"}, FL`,
      city: card.city || "",
      priceMin: card.priceRaw ? parseFloat(card.priceRaw) : undefined,
      priceMax: card.priceMaxRaw ? parseFloat(card.priceMaxRaw) : undefined,
      bedrooms: card.beds ? `${card.beds}BR` : undefined,
      imageUrl: card.imageUrl || undefined,
      scrapedAt: new Date().toISOString(),
    })
  }

  return communities
}

/** Scrape a single ShowingNew search by intercepting API responses */
async function scrapeWithPlaywright(searchTerm?: string): Promise<ScrapedCommunity[]> {
  let chromium: any
  try {
    chromium = require("playwright").chromium
  } catch {
    console.warn("[ShowingNew] playwright not available")
    return []
  }

  const executablePath = getChromiumPath()
  if (!executablePath) {
    console.warn("[ShowingNew] No system Chromium found. Set SHOWINGNEW_CHROMIUM_PATH env var.")
    return []
  }

  let browser: any = null
  try {
    browser = await chromium.launch({
      executablePath,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
      ],
    })
    const ctx = await browser.newContext({
      ignoreHTTPSErrors: true,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    })
    const page = await ctx.newPage()

    // Capture JSON API responses that contain community data
    const apiCommunities: ScrapedCommunity[] = []
    page.on("response", async (res: any) => {
      try {
        const url: string = res.url()
        const ct: string = res.headers()["content-type"] || ""
        if (!ct.includes("json")) return
        if (url.includes("google") || url.includes("analytics") || url.includes("gtag")) return
        const body = await res.text().catch(() => "")
        if (!body || body.length < 100) return
        if (!body.includes("price") && !body.includes("community") && !body.includes("builder")) return
        try {
          const data = JSON.parse(body)
          const found = extractCommunitiesFromJson(data)
          apiCommunities.push(...found)
        } catch {}
      } catch {}
    })

    const url = searchTerm
      ? `${AGENT_URL}?search=${encodeURIComponent(searchTerm)}`
      : AGENT_URL

    await page.goto(url, { timeout: 30000, waitUntil: "networkidle" }).catch(() =>
      page.goto(url, { timeout: 30000, waitUntil: "domcontentloaded" })
    )
    await page.waitForTimeout(3000)

    // If we captured API data, use that (most reliable)
    if (apiCommunities.length > 0) {
      console.log(`[ShowingNew] API intercept for "${searchTerm || "main"}" → ${apiCommunities.length}`)
      return apiCommunities
    }

    // Fall back to DOM parsing
    const domCommunities = await extractCommunitiesFromPage(page)
    if (domCommunities.length > 0) {
      console.log(`[ShowingNew] DOM parse for "${searchTerm || "main"}" → ${domCommunities.length}`)
    }
    return domCommunities
  } catch (e: any) {
    console.warn(`[ShowingNew] Playwright error for "${searchTerm || "main"}":`, e?.message)
    return []
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}

/** Recursively walk any JSON structure looking for community-like objects */
function extractCommunitiesFromJson(obj: any, depth = 0): ScrapedCommunity[] {
  if (depth > 8 || !obj) return []
  const results: ScrapedCommunity[] = []

  if (Array.isArray(obj)) {
    for (const item of obj) results.push(...extractCommunitiesFromJson(item, depth + 1))
    return results
  }

  if (typeof obj === "object") {
    const keys = Object.keys(obj).map(k => k.toLowerCase())
    const hasCity = keys.some(k => ["city", "location", "address", "area"].includes(k))
    const hasPrice = keys.some(k => k.includes("price") || k.includes("cost") || k.includes("starting"))

    if (hasCity && hasPrice) {
      const community = parseCommunityObject(obj)
      if (community) { results.push(community); return results }
    }
    for (const val of Object.values(obj)) results.push(...extractCommunitiesFromJson(val, depth + 1))
  }
  return results
}

function parseCommunityObject(obj: any): ScrapedCommunity | null {
  const city = obj.city || obj.City || obj.location || obj.area || obj.neighborhood || ""
  if (!city) return null

  return {
    area: `${city}, FL`,
    city: city.toString().replace(/,?\s*fl$/i, "").trim(),
    zipCode: obj.zipCode || obj.zip || obj.postalCode || undefined,
    priceMin: parsePrice((obj.priceMin || obj.price || obj.startingPrice || obj.fromPrice || obj.minPrice)?.toString()),
    priceMax: parsePrice((obj.priceMax || obj.toPrice || obj.maxPrice)?.toString()),
    bedrooms: (obj.bedrooms || obj.beds || obj.bedroomRange)?.toString() || undefined,
    deliveryDate: (obj.deliveryDate || obj.completionDate || obj.expectedDelivery)?.toString() || undefined,
    status: (obj.status || obj.phase)?.toString() || undefined,
    description: (obj.description || obj.shortDescription || obj.summary || "").toString().substring(0, 300) || undefined,
    imageUrl: obj.imageUrl || obj.image || obj.heroImage || obj.photo || obj.thumbnail || undefined,
    scrapedAt: new Date().toISOString(),
  }
}

/** Main entry: scrape ShowingNew for all FL cities */
export async function scrapeShowingNew(): Promise<{
  communities: ScrapedCommunity[]
  errors: string[]
  strategy: string
}> {
  const errors: string[] = []
  let strategy = "none"

  // Step 1: Scrape the main agent page (gets all communities at once)
  console.log("[ShowingNew] Starting scrape of main agent page...")
  const mainResults = await scrapeWithPlaywright().catch((e: any) => {
    errors.push(`main: ${e?.message}`)
    return [] as ScrapedCommunity[]
  })

  if (mainResults.length > 0) {
    strategy = "playwright-main"
    const deduped = dedup(mainResults)
    console.log(`[ShowingNew] Done: ${deduped.length} communities via ${strategy}`)
    return { communities: deduped, errors, strategy }
  }

  // Step 2: Try searching per city (catches geographically-filtered results)
  console.log("[ShowingNew] Main page yielded 0, trying per-city search...")
  const allResults: ScrapedCommunity[] = []
  for (const city of FL_SEARCH_TERMS) {
    const found = await scrapeWithPlaywright(city).catch((e: any) => {
      errors.push(`${city}: ${e?.message}`)
      return [] as ScrapedCommunity[]
    })
    allResults.push(...found)
    if (found.length > 0) strategy = "playwright-per-city"
  }

  const deduped = dedup(allResults)
  console.log(`[ShowingNew] Done: ${deduped.length} communities via ${strategy}`)
  return { communities: deduped, errors, strategy }
}

function dedup(communities: ScrapedCommunity[]): ScrapedCommunity[] {
  const seen = new Set<string>()
  return communities.filter(c => {
    const key = `${c.area}|${c.priceMin}|${c.bedrooms}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
