/**
 * ShowingNew scraper — fetches new construction communities from the agent's
 * ShowingNew page using a headless browser (Playwright).
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
  "Miami FL", "Doral FL", "Kendall FL", "Homestead FL", "Hollywood FL",
  "Miramar FL", "Weston FL", "Aventura FL", "Miami Gardens FL", "Cutler Bay FL",
  "Palmetto Bay FL", "Coral Gables FL", "Hialeah FL", "North Miami FL",
  "Sunrise FL", "Davie FL", "Pembroke Pines FL", "Coral Springs FL",
  "Plantation FL", "Fort Lauderdale FL", "Pompano Beach FL", "Deerfield Beach FL",
  "Hallandale FL", "Boca Raton FL", "Delray Beach FL", "Boynton Beach FL",
  "Lake Worth FL", "West Palm Beach FL", "Wellington FL", "Jupiter FL",
  "Palm Beach Gardens FL", "Royal Palm Beach FL", "Tamarac FL",
  "Margate FL", "Coconut Creek FL", "Lauderhill FL",
]

function parsePrice(s: string | undefined | null): number | undefined {
  if (!s) return undefined
  const n = parseFloat(s.replace(/[^0-9.]/g, ""))
  return isNaN(n) ? undefined : n
}

/** Find the full Chromium binary (NOT the headless shell) */
export function getChromiumPath(): string | null {
  const { execSync } = require("child_process")

  if (process.env.SHOWINGNEW_CHROMIUM_PATH) return process.env.SHOWINGNEW_CHROMIUM_PATH

  const searches = [
    "find /root/.cache/ms-playwright/chromium-* -name 'chrome' -not -name 'chrome-headless-shell' -type f 2>/dev/null | head -1",
    "find /home -path '*/ms-playwright/chromium-*/chrome-linux64/chrome' -type f 2>/dev/null | head -1",
    "find /opt/pw-browsers -name 'chrome' -not -name 'chrome-headless-shell' -type f 2>/dev/null | head -1",
  ]
  for (const cmd of searches) {
    try {
      const p = execSync(cmd, { encoding: "utf8", timeout: 8000 }).trim()
      if (p) { console.log("[ShowingNew] Chromium:", p); return p }
    } catch {}
  }

  for (const bin of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    try {
      const p = execSync(`which ${bin} 2>/dev/null`, { encoding: "utf8", timeout: 3000 }).trim()
      if (p) { console.log("[ShowingNew] System Chrome:", p); return p }
    } catch {}
  }

  console.error("[ShowingNew] No Chromium found")
  return null
}

/** Scrape ShowingNew with full stealth + multiple extraction strategies */
async function scrapeWithPlaywright(searchTerm?: string): Promise<ScrapedCommunity[]> {
  let chromium: any
  try {
    chromium = require("playwright").chromium
  } catch {
    console.warn("[ShowingNew] playwright not available")
    return []
  }

  const executablePath = getChromiumPath()
  if (!executablePath) return []

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
      "--window-size=1280,900",
    ],
  }).catch((e: any) => { console.error("[ShowingNew] launch failed:", e?.message); return null })
  if (!browser) return []

  try {
    const ctx = await browser.newContext({
      ignoreHTTPSErrors: true,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
      locale: "en-US",
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9",
      },
    })

    // Remove navigator.webdriver fingerprint
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined })
      ;(window as any).chrome = { runtime: {} }
    })

    const page = await ctx.newPage()

    // Collect ALL JSON API responses
    const captured: any[] = []
    page.on("response", async (res: any) => {
      try {
        const url: string = res.url()
        const ct: string = res.headers()["content-type"] || ""
        if (!ct.includes("json")) return
        if (url.includes("google") || url.includes("analytics") || url.includes("gtag") || url.includes("font")) return
        const body = await res.text().catch(() => "")
        if (body.length < 50) return
        if (body[0] !== "{" && body[0] !== "[") return
        try {
          const data = JSON.parse(body)
          console.log(`[ShowingNew] JSON from ${url.substring(0, 100)} (${body.length}b)`)
          captured.push({ url, data })
        } catch {}
      } catch {}
    })

    const url = searchTerm
      ? `${AGENT_URL}?search=${encodeURIComponent(searchTerm)}`
      : AGENT_URL

    // Navigate — try networkidle first, fall back to domcontentloaded
    try {
      await page.goto(url, { timeout: 35000, waitUntil: "networkidle" })
    } catch {
      try {
        await page.goto(url, { timeout: 35000, waitUntil: "domcontentloaded" })
      } catch (e: any) {
        console.warn(`[ShowingNew] navigation failed "${searchTerm || "main"}":`, e?.message?.split("\n")[0])
      }
    }

    // Wait extra time for React to render + scroll to trigger lazy loads
    await page.waitForTimeout(5000)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {})
    await page.waitForTimeout(2000)
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {})
    await page.waitForTimeout(1000)

    // Strategy 1: Extract from __NEXT_DATA__ or window state
    const nextData = await page.evaluate(() => {
      try {
        const el = document.getElementById("__NEXT_DATA__")
        if (el?.textContent) return JSON.parse(el.textContent)
      } catch {}
      try {
        return (window as any).__INITIAL_STATE__ || (window as any).__APP_STATE__ || null
      } catch {}
      return null
    }).catch(() => null)

    if (nextData) {
      console.log("[ShowingNew] Found __NEXT_DATA__, extracting...")
      const fromNext = extractCommunitiesFromJson(nextData)
      if (fromNext.length > 0) {
        console.log(`[ShowingNew] __NEXT_DATA__ → ${fromNext.length} communities`)
        return fromNext
      }
    }

    // Strategy 2: Communities from captured JSON API responses
    if (captured.length > 0) {
      const all: ScrapedCommunity[] = []
      for (const { url: apiUrl, data } of captured) {
        const found = extractCommunitiesFromJson(data)
        if (found.length > 0) {
          console.log(`[ShowingNew] API ${apiUrl.substring(0, 80)} → ${found.length}`)
          all.push(...found)
        }
      }
      if (all.length > 0) return all
    }

    // Strategy 3: DOM extraction with flexible selectors
    const domResults = await extractFromDom(page)
    if (domResults.length > 0) {
      console.log(`[ShowingNew] DOM "${searchTerm || "main"}" → ${domResults.length}`)
      return domResults
    }

    // Log what the page actually shows for debugging
    const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 500)).catch(() => "")
    console.log(`[ShowingNew] Page text preview: ${pageText}`)
    console.log(`[ShowingNew] Captured ${captured.length} JSON responses, 0 communities extracted`)
    return []

  } catch (e: any) {
    console.warn(`[ShowingNew] error "${searchTerm || "main"}":`, e?.message?.split("\n")[0])
    return []
  } finally {
    await browser.close().catch(() => {})
  }
}

async function extractFromDom(page: any): Promise<ScrapedCommunity[]> {
  const raw = await page.evaluate(() => {
    const results: any[] = []

    // Try many selectors that community/property card platforms use
    const selectorSets = [
      "[class*='community']", "[class*='Community']",
      "[class*='listing']", "[class*='Listing']",
      "[class*='property']", "[class*='Property']",
      "[class*='card']", "[class*='Card']",
      "[class*='home']", "[class*='Home']",
      "[data-testid]", "article",
      ".MuiCard-root", "[class*='MuiCard']",
      "[class*='result']", "[class*='Result']",
    ]

    for (const sel of selectorSets) {
      let els: Element[]
      try { els = Array.from(document.querySelectorAll(sel)) } catch { continue }
      if (els.length < 1) continue

      const candidates = els.filter(el => {
        const text = (el as HTMLElement).innerText || ""
        return text.match(/\$[\d,]+/) || text.match(/\d+\s*(?:bed|ba|sqft)/i)
      })
      if (candidates.length === 0) continue

      for (const el of candidates) {
        const text = (el as HTMLElement).innerText || ""
        const cityMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),?\s*FL/i)
        const priceMatch = text.match(/\$\s*([\d,]+)/)
        const priceMaxMatch = text.match(/[-–]\s*\$\s*([\d,]+)/)
        const bedsMatch = text.match(/(\d+(?:\s*[-–]\s*\d+)?)\s*(?:bed|BR|bd)/i)
        const zipMatch = text.match(/\b(3[0-9]{4})\b/)
        const imgEl = (el as HTMLElement).querySelector("img")

        results.push({
          city: cityMatch ? cityMatch[1].trim() : "",
          priceMin: priceMatch ? priceMatch[1].replace(/,/g, "") : null,
          priceMax: priceMaxMatch ? priceMaxMatch[1].replace(/,/g, "") : null,
          bedrooms: bedsMatch ? bedsMatch[1].trim() : null,
          zipCode: zipMatch ? zipMatch[1] : null,
          imageUrl: imgEl?.getAttribute("src") || imgEl?.getAttribute("data-src") || null,
        })
      }
      if (results.length > 0) break
    }
    return results
  }).catch(() => [] as any[])

  return (raw as any[])
    .filter((c: any) => c.city || c.priceMin)
    .map((c: any) => ({
      area: `${c.city || "South Florida"}, FL`,
      city: (c.city || "").replace(/,?\s*fl$/i, "").trim(),
      zipCode: c.zipCode || undefined,
      priceMin: c.priceMin ? parseFloat(c.priceMin) : undefined,
      priceMax: c.priceMax ? parseFloat(c.priceMax) : undefined,
      bedrooms: c.bedrooms || undefined,
      imageUrl: c.imageUrl || undefined,
      scrapedAt: new Date().toISOString(),
    }))
}

function extractCommunitiesFromJson(obj: any, depth = 0): ScrapedCommunity[] {
  if (depth > 10 || !obj) return []
  const results: ScrapedCommunity[] = []

  if (Array.isArray(obj)) {
    for (const item of obj) results.push(...extractCommunitiesFromJson(item, depth + 1))
    return results
  }

  if (typeof obj === "object") {
    const keys = Object.keys(obj).map(k => k.toLowerCase())
    const hasLocation = keys.some(k => ["city", "location", "address", "area", "neighborhood", "county", "state", "zip", "zipcode"].includes(k))
    const hasPrice = keys.some(k => k.includes("price") || k.includes("starting") || k.includes("from") || k.includes("cost"))

    if (hasLocation && hasPrice) {
      const c = parseCommunityObject(obj)
      if (c) { results.push(c); return results }
    }

    // Also try arrays nested in this object
    for (const val of Object.values(obj)) {
      if (val && typeof val === "object") {
        results.push(...extractCommunitiesFromJson(val, depth + 1))
      }
    }
  }

  return results
}

function parseCommunityObject(obj: any): ScrapedCommunity | null {
  // Try many field name variations ShowingNew or similar platforms might use
  const city = obj.city || obj.City || obj.cityName ||
    obj.location || obj.Location ||
    obj.area || obj.Area ||
    obj.neighborhood || obj.Neighborhood ||
    obj.municipality || obj.market ||
    ""
  if (!city || typeof city !== "string") return null

  const cleanCity = city.toString().replace(/,?\s*fl$/i, "").trim()
  if (!cleanCity) return null

  return {
    area: `${cleanCity}, FL`,
    city: cleanCity,
    zipCode: (obj.zipCode || obj.zip || obj.postalCode || obj.postal_code || obj.ZipCode)?.toString() || undefined,
    priceMin: parsePrice(
      (obj.priceMin || obj.price || obj.startingPrice || obj.starting_price ||
        obj.fromPrice || obj.from_price || obj.minPrice || obj.loPrice ||
        obj.basePrice || obj.base_price || obj.Price || obj.priceFrom)?.toString()
    ),
    priceMax: parsePrice(
      (obj.priceMax || obj.toPrice || obj.maxPrice || obj.highPrice ||
        obj.hiPrice || obj.priceTo || obj.priceThrough)?.toString()
    ),
    bedrooms: (obj.bedrooms || obj.beds || obj.bedroomRange || obj.bedroom_range ||
      obj.minBeds || obj.maxBeds || obj.bed_count)?.toString() || undefined,
    deliveryDate: (obj.deliveryDate || obj.completionDate || obj.delivery ||
      obj.moveInDate || obj.move_in_date || obj.estCompletion)?.toString() || undefined,
    status: (obj.status || obj.phase || obj.saleStatus || obj.sale_status)?.toString() || undefined,
    description: ((obj.description || obj.shortDescription || obj.short_description ||
      obj.summary || obj.overview || "") as string).substring(0, 300) || undefined,
    imageUrl: obj.imageUrl || obj.image || obj.heroImage || obj.hero_image ||
      obj.photo || obj.thumbnail || obj.coverImage || obj.cover_image ||
      obj.mainImage || obj.main_image || obj.primaryImage || undefined,
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

  // Step 1: Main page (gets all communities at once)
  const mainResults = await scrapeWithPlaywright().catch((e: any) => {
    errors.push(`main: ${e?.message}`)
    return [] as ScrapedCommunity[]
  })

  if (mainResults.length > 0) {
    return { communities: dedup(mainResults), errors, strategy: "playwright-main" }
  }

  // Step 2: Per-city search if main page yielded nothing
  const allResults: ScrapedCommunity[] = []
  let strategy = "none"

  // Only try a subset of cities to avoid timeout — prioritize South Florida
  const priorityCities = FL_SEARCH_TERMS.slice(0, 12)
  for (const city of priorityCities) {
    const found = await scrapeWithPlaywright(city).catch((e: any) => {
      errors.push(`${city}: ${e?.message}`)
      return [] as ScrapedCommunity[]
    })
    allResults.push(...found)
    if (found.length > 0) strategy = "playwright-per-city"
    if (allResults.length >= 30) break // enough
  }

  return { communities: dedup(allResults), errors, strategy }
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
