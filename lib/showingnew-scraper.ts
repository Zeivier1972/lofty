/**
 * ShowingNew scraper — NewHomeSource Professional platform by BDX.
 *
 * All search pages lazy-load results via AJAX (IntersectionObserver).
 * An ASP.NET session cookie must first be set by visiting the homepage.
 *
 * Primary: intercept communityresults/getresultshomes via page.route() → clean city/price/beds data
 *
 * NEVER exposes builder name, community name, or direct URL to leads.
 */

export interface ScrapedCommunity {
  area: string
  city: string
  zipCode?: string
  priceMin?: number
  priceMax?: number
  bedrooms?: string
  deliveryDate?: string
  description?: string
  imageUrl?: string
  scrapedAt: string
}

const AGENT_URL = "https://www.showingnew.com/catherinegomez"

const SEARCH_PAGES = [
  "https://www.showingnew.com/catherinegomez/homes/florida/miami-dade-county",
  "https://www.showingnew.com/catherinegomez/homes/florida/miami-dade-county/city-homestead",
  "https://www.showingnew.com/catherinegomez/homes/florida/miami-dade-county/city-florida-city",
  "https://www.showingnew.com/catherinegomez/homes/florida/broward-county-ft.-lauderdale/",
  "https://www.showingnew.com/catherinegomez/homes/florida/palm-beach-county/city-west-palm-beach",
  "https://www.showingnew.com/catherinegomez/communities/florida/miami-dade-county",
]

/** Find the full Chromium binary */
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
      if (p) return p
    } catch {}
  }
  return null
}

/**
 * Parse the communityresults/getresultshomes JSON response.
 * Returns one ScrapedCommunity per city listed in FacetsCounts.Cities,
 * using the shared PrRange and BrRange for the search page.
 * Builder names and community names are intentionally NOT stored.
 */
function parseGetResultsHomesJson(body: string, pageUrl: string): ScrapedCommunity[] {
  let json: any
  try { json = JSON.parse(body) } catch { return [] }

  const facets = json && json.FacetsCounts
  if (!facets) return []

  const now = new Date().toISOString()

  // Parse price range "439900-924900"
  let priceMin: number | undefined
  let priceMax: number | undefined
  if (facets.PrRange && typeof facets.PrRange === "string") {
    const parts = (facets.PrRange as string).split("-")
    const lo = parseInt(parts[0] || "", 10)
    const hi = parseInt(parts[1] || "", 10)
    if (!isNaN(lo) && lo > 0) priceMin = lo
    if (!isNaN(hi) && hi > 0) priceMax = hi
  }

  // Parse bedroom range "3-4" or "3"
  let bedrooms: string | undefined
  if (facets.BrRange && typeof facets.BrRange === "string") {
    bedrooms = (facets.BrRange as string).trim()
  }

  // Extract readable area from page URL
  // e.g. ".../miami-dade-county" → "Miami-Dade County"
  // e.g. ".../city-homestead" → "Homestead"
  const urlSegs = pageUrl.replace(/\/$/, "").split("/")
  const lastSeg = urlSegs[urlSegs.length - 1] || ""
  let areaLabel = lastSeg.replace(/^city-/, "").replace(/-/g, " ")
    .replace(/\b\w/g, function(l: string) { return l.toUpperCase() })
  if (!areaLabel) areaLabel = "South Florida"

  const cities: string[] = []
  if (facets.Cities && Array.isArray(facets.Cities)) {
    for (let i = 0; i < facets.Cities.length; i++) {
      const v = facets.Cities[i] && facets.Cities[i].Value
      if (typeof v === "string" && v.trim()) cities.push(v.trim())
    }
  }

  // If no cities found in facets, create one entry for the area
  if (cities.length === 0) {
    if (!priceMin && !priceMax) return []
    return [{
      area: areaLabel + ", FL",
      city: areaLabel,
      priceMin,
      priceMax,
      bedrooms,
      description: areaLabel + " new construction homes",
      scrapedAt: now,
    }]
  }

  const results: ScrapedCommunity[] = []
  for (let i = 0; i < cities.length; i++) {
    results.push({
      area: cities[i] + ", FL",
      city: cities[i],
      priceMin,
      priceMax,
      bedrooms,
      description: cities[i] + " new construction homes",
      scrapedAt: now,
    })
  }
  return results
}

async function scrapePageWithPlaywright(
  page: any,
  url: string
): Promise<ScrapedCommunity[]> {
  // Passively capture the getresultshomes request metadata (URL, method, headers).
  // We don't intercept — the browser makes the call normally. After the page loads
  // and scrolls, we replay the request from Node.js where response.text() is reliable.
  const capturedReqs: Array<{
    reqUrl: string
    method: string
    headers: Record<string, string>
    postData: string | undefined
  }> = []

  const onRequest = (req: any) => {
    try {
      const reqUrl: string = typeof req.url === "function" ? req.url() : ""
      if (reqUrl.toLowerCase().includes("getresultshomes")) {
        capturedReqs.push({
          reqUrl,
          method: typeof req.method === "function" ? req.method() : "GET",
          headers: typeof req.headers === "function" ? (req.headers() || {}) : {},
          postData: typeof req.postData === "function" ? (req.postData() || undefined) : undefined,
        })
        console.log("[ShowingNew] Request observed: " + reqUrl.substring(0, 120))
      }
    } catch {}
  }

  try {
    page.on("request", onRequest)

    try { await page.goto(url, { timeout: 35000, waitUntil: "networkidle" }) } catch {
      try { await page.goto(url, { timeout: 25000, waitUntil: "load" }) } catch {}
    }

    // Progressive scroll to trigger IntersectionObserver lazy loading
    await page.evaluate(function() {
      return new Promise<void>(function(resolve) {
        let pos = 0
        const step = 250
        const max = Math.min(document.body.scrollHeight, 4000)
        const id = setInterval(function() {
          window.scrollTo(0, pos)
          window.dispatchEvent(new Event("scroll"))
          pos += step
          if (pos > max) { clearInterval(id); window.scrollTo(0, 0); resolve() }
        }, 150)
      })
    }).catch(() => {})

    await page.waitForTimeout(3000)

    console.log("[ShowingNew] " + capturedReqs.length + " getresultshomes request(s) observed from " + url)

    if (capturedReqs.length === 0) {
      console.log("[ShowingNew] " + url + " — AJAX not triggered; site may need JS or a different scroll trigger")
      return []
    }

    // Replay each captured request from Node.js — response.text() here is always reliable
    for (let i = 0; i < capturedReqs.length; i++) {
      const { reqUrl, method, headers, postData } = capturedReqs[i]
      try {
        // Strip HTTP/2 pseudo-headers that Node.js fetch rejects
        const cleanHeaders: Record<string, string> = {}
        for (const [k, v] of Object.entries(headers)) {
          if (!k.startsWith(":")) cleanHeaders[k] = v
        }

        const fetchInit: any = { method, headers: cleanHeaders }
        if (postData && method !== "GET" && method !== "HEAD") fetchInit.body = postData

        const res = await fetch(reqUrl, fetchInit)
        const body = await res.text()
        console.log("[ShowingNew] Replayed " + method + " → status=" + res.status + " len=" + body.length + " " + reqUrl.substring(0, 80))

        if (res.ok && body.length >= 50) {
          const found = parseGetResultsHomesJson(body, url)
          if (found.length > 0) {
            console.log("[ShowingNew] Parsed " + found.length + " cities from " + url)
            return found
          }
          console.log("[ShowingNew] Response OK but no cities/prices; body start: " + body.substring(0, 150))
        }
      } catch (e: any) {
        console.log("[ShowingNew] Replay failed: " + (e?.message || e))
      }
    }

    return []
  } finally {
    try { page.off("request", onRequest) } catch {}
  }
}

async function scrapeWithPlaywright(): Promise<{ communities: ScrapedCommunity[]; errors: string[]; strategy: string }> {
  let chromium: any
  try { chromium = require("playwright").chromium } catch {
    return { communities: [], errors: ["playwright not available"], strategy: "none" }
  }
  const executablePath = getChromiumPath()
  if (!executablePath) return { communities: [], errors: ["chromium not found"], strategy: "none" }

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--no-first-run"],
  }).catch((e: any) => { console.error("[ShowingNew] launch failed:", e?.message); return null })
  if (!browser) return { communities: [], errors: ["browser launch failed"], strategy: "none" }

  try {
    const ctx = await browser.newContext({
      ignoreHTTPSErrors: true,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
      extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
    })
    const page = await ctx.newPage()

    // Establish ASP.NET session
    console.log("[ShowingNew] Homepage (session)…")
    try { await page.goto(AGENT_URL, { timeout: 30000, waitUntil: "networkidle" }) } catch {
      try { await page.goto(AGENT_URL, { timeout: 20000, waitUntil: "load" }) } catch {}
    }
    await page.waitForTimeout(800)

    const allCommunities: ScrapedCommunity[] = []
    const seen = new Set<string>()

    for (let i = 0; i < SEARCH_PAGES.length; i++) {
      const url = SEARCH_PAGES[i]
      console.log("[ShowingNew] Scraping: " + url)
      const found = await scrapePageWithPlaywright(page, url)
      console.log("[ShowingNew] Found " + found.length + " from " + url)
      for (let j = 0; j < found.length; j++) {
        const key = found[j].city + "|" + found[j].priceMin
        if (!seen.has(key)) { seen.add(key); allCommunities.push(found[j]) }
      }
    }

    if (allCommunities.length > 0) {
      return { communities: allCommunities, errors: [], strategy: "playwright-json" }
    }
    return { communities: [], errors: ["no communities on any page"], strategy: "none" }

  } catch (e: any) {
    return { communities: [], errors: [e?.message || "unknown"], strategy: "none" }
  } finally {
    await browser.close().catch(() => {})
  }
}

export async function scrapeShowingNew(): Promise<{
  communities: ScrapedCommunity[]
  errors: string[]
  strategy: string
}> {
  const result = await scrapeWithPlaywright().catch((e: any) => ({
    communities: [] as ScrapedCommunity[],
    errors: [e?.message || "unknown"],
    strategy: "none",
  }))
  return {
    communities: dedup(result.communities),
    errors: result.errors,
    strategy: result.strategy,
  }
}

function dedup(cs: ScrapedCommunity[]): ScrapedCommunity[] {
  const seen = new Set<string>()
  return cs.filter(function(c) {
    const k = c.area + "|" + c.priceMin + "|" + c.bedrooms
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
