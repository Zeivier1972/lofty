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

/** Resolve Playwright's bundled Chromium path at runtime */
export function getChromiumPath(): string | null {
  // 1. Explicit env override (set on Railway if auto-detection fails)
  if (process.env.SHOWINGNEW_CHROMIUM_PATH) return process.env.SHOWINGNEW_CHROMIUM_PATH

  // 2. Let Playwright find its own browser (returns undefined if not downloaded)
  try {
    const { chromium } = require("playwright")
    const info = chromium.executablePath?.()
    if (info) return info
  } catch {}

  // 3. Search common system and Playwright cache paths
  const { execSync } = require("child_process")
  const searches = [
    "which chromium 2>/dev/null",
    "which chromium-browser 2>/dev/null",
    "which google-chrome 2>/dev/null",
    "find /root/.cache/ms-playwright -name 'chrome' -type f 2>/dev/null | head -1",
    "find /home -name 'chrome' -path '*/ms-playwright/*' -type f 2>/dev/null | head -1",
    "find /usr -name 'chromium' -type f 2>/dev/null | head -1",
    "find /nix -name 'chromium' -type f 2>/dev/null | head -1",
  ]
  for (const cmd of searches) {
    try {
      const p = execSync(cmd, { encoding: "utf8", timeout: 5000 }).trim()
      if (p && !p.includes("(error")) {
        console.log("[ShowingNew] Found chromium:", p, "via:", cmd.split(" ")[0])
        return p
      }
    } catch {}
  }

  console.error("[ShowingNew] No Chromium found. Options: " +
    "1) Set SHOWINGNEW_CHROMIUM_PATH env var on Railway, " +
    "2) Ensure nixpacks.toml runs 'npx playwright install chromium' during build")
  return null
}

/** Scrape a ShowingNew page using Playwright, intercepting both API responses and DOM */
async function scrapeWithPlaywright(searchTerm?: string): Promise<ScrapedCommunity[]> {
  let chromium: any
  try {
    chromium = require("playwright").chromium
  } catch {
    console.warn("[ShowingNew] playwright package not available")
    return []
  }

  const launchOptions: any = {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
    ],
  }

  // Use system/env chromium path if Playwright's own isn't available
  const executablePath = getChromiumPath()
  if (executablePath && !executablePath.includes("ms-playwright")) {
    launchOptions.executablePath = executablePath
  }

  let browser: any = null
  try {
    browser = await chromium.launch(launchOptions)
    const ctx = await browser.newContext({
      ignoreHTTPSErrors: true,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    })
    const page = await ctx.newPage()

    // Intercept JSON API responses the React app makes while loading
    const apiCommunities: ScrapedCommunity[] = []
    page.on("response", async (res: any) => {
      try {
        const url: string = res.url()
        const ct: string = res.headers()["content-type"] || ""
        if (!ct.includes("json")) return
        if (url.includes("google") || url.includes("analytics") || url.includes("gtag")) return
        const body = await res.text().catch(() => "")
        if (!body || body.length < 100) return
        if (!body.includes("price") && !body.includes("community") && !body.includes("builder") && !body.includes("Price")) return
        try {
          const data = JSON.parse(body)
          apiCommunities.push(...extractCommunitiesFromJson(data))
        } catch {}
      } catch {}
    })

    const url = searchTerm
      ? `${AGENT_URL}?search=${encodeURIComponent(searchTerm)}`
      : AGENT_URL

    try {
      await page.goto(url, { timeout: 30000, waitUntil: "networkidle" })
    } catch {
      await page.goto(url, { timeout: 30000, waitUntil: "domcontentloaded" }).catch(() => {})
    }
    await page.waitForTimeout(4000)

    if (apiCommunities.length > 0) {
      console.log(`[ShowingNew] API intercept "${searchTerm || "main"}" → ${apiCommunities.length}`)
      return apiCommunities
    }

    // Fall back to DOM parsing
    return extractCommunitiesFromDom(page)
  } catch (e: any) {
    console.warn(`[ShowingNew] Playwright error "${searchTerm || "main"}":`, e?.message?.split("\n")[0])
    return []
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}

async function extractCommunitiesFromDom(page: any): Promise<ScrapedCommunity[]> {
  const cards = await page.evaluate(() => {
    const results: any[] = []
    const selectors = [
      "[class*='community']", "[class*='Community']",
      "[class*='listing']", "[class*='home-card']",
      "[class*='property']", "[class*='card']", "article",
    ]
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel)
      if (els.length < 2) continue
      for (const el of Array.from(els)) {
        const text = (el as HTMLElement).innerText || ""
        if (!text.match(/\$[\d,]+/)) continue
        const cityMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),?\s*FL/)
        const priceMatch = text.match(/\$\s*([\d,]+)/)
        const priceMaxMatch = text.match(/–\s*\$\s*([\d,]+)/)
        const imgEl = (el as HTMLElement).querySelector("img")
        results.push({
          city: cityMatch ? cityMatch[1] : "",
          priceRaw: priceMatch ? priceMatch[1].replace(/,/g, "") : null,
          priceMaxRaw: priceMaxMatch ? priceMaxMatch[1].replace(/,/g, "") : null,
          imageUrl: imgEl?.getAttribute("src") || imgEl?.getAttribute("data-src") || null,
        })
      }
      if (results.length > 0) break
    }
    return results
  }).catch(() => [] as any[])

  return cards
    .filter((c: any) => c.city || c.priceRaw)
    .map((c: any) => ({
      area: `${c.city || "South Florida"}, FL`,
      city: c.city || "",
      priceMin: c.priceRaw ? parseFloat(c.priceRaw) : undefined,
      priceMax: c.priceMaxRaw ? parseFloat(c.priceMaxRaw) : undefined,
      imageUrl: c.imageUrl || undefined,
      scrapedAt: new Date().toISOString(),
    }))
}

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
    const hasPrice = keys.some(k => k.includes("price") || k.includes("starting"))
    if (hasCity && hasPrice) {
      const c = parseCommunityObject(obj)
      if (c) { results.push(c); return results }
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
    priceMin: parsePrice((obj.priceMin || obj.price || obj.startingPrice || obj.fromPrice)?.toString()),
    priceMax: parsePrice((obj.priceMax || obj.toPrice || obj.maxPrice)?.toString()),
    bedrooms: (obj.bedrooms || obj.beds || obj.bedroomRange)?.toString() || undefined,
    deliveryDate: (obj.deliveryDate || obj.completionDate)?.toString() || undefined,
    status: (obj.status || obj.phase)?.toString() || undefined,
    description: (obj.description || obj.shortDescription || "").toString().substring(0, 300) || undefined,
    imageUrl: obj.imageUrl || obj.image || obj.heroImage || obj.photo || undefined,
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
  const mainResults = await scrapeWithPlaywright().catch((e: any) => {
    errors.push(`main: ${e?.message}`)
    return [] as ScrapedCommunity[]
  })

  if (mainResults.length > 0) {
    return { communities: dedup(mainResults), errors, strategy: "playwright-main" }
  }

  // Step 2: Try per-city search if main page yielded nothing
  const allResults: ScrapedCommunity[] = []
  for (const city of FL_SEARCH_TERMS) {
    const found = await scrapeWithPlaywright(city).catch((e: any) => {
      errors.push(`${city}: ${e?.message}`)
      return [] as ScrapedCommunity[]
    })
    allResults.push(...found)
    if (found.length > 0) strategy = "playwright-per-city"
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
