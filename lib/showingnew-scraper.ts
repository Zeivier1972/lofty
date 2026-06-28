/**
 * ShowingNew scraper — NewHomeSource Professional platform by BDX.
 *
 * All search pages (homepage, /homes/*, /communities/*) lazy-load results
 * via AJAX (IntersectionObserver + AjaxHelper.load). An ASP.NET session
 * cookie must first be set by visiting the homepage.
 *
 * Approach:
 * 1. Visit homepage → session cookie
 * 2. For each search page: navigate, scroll progressively, capture AJAX HTML
 * 3. Parse whichever AJAX response contains listing data
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

function hasPriceOrCity(text: string): boolean {
  return /\$\s*[\d,]{4,}/.test(text) || /[A-Z][a-zA-Z-]+,?\s*FL\b/.test(text)
}

/** Extract communities from a block of visible text using regex segmentation */
function parseFromVisibleText(text: string): ScrapedCommunity[] {
  if (!text || text.length < 100) return []
  const now = new Date().toISOString()
  const communities: ScrapedCommunity[] = []

  // Split visible text at price boundaries to get one block per listing
  // e.g. "Miami, FL ... From $450,000 ... 3 Beds | Broward, FL ... From $380,000 ..."
  const chunks = text.split(/(?=\$\s*[\d,]{6,})/)

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i].substring(0, 400)
    if (!hasPriceOrCity(chunk)) continue

    const cityM = chunk.match(/([A-Z][a-zA-Z-]+(?:\s+[A-Z][a-zA-Z-]+)*)\s*,?\s*FL\b/)
    const priceRe = /\$\s*([\d,]+)/g
    const prices: number[] = []
    let pm: RegExpExecArray | null
    while ((pm = priceRe.exec(chunk)) !== null) {
      const n = parseFloat(pm[1].replace(/,/g, ""))
      if (n >= 50000 && n <= 20000000) prices.push(n)
    }
    prices.sort(function(a, b) { return a - b })

    const bedM = chunk.match(/(\d+(?:\s*[-–]\s*\d+)?)\s*(?:Bed|bed|BD|BR)\b/i)
    const zipM = chunk.match(/\b(3[0-9]{4})\b/)
    const dateM = chunk.match(/(?:Q[1-4]\s*20\d{2}|(?:Spring|Summer|Fall|Winter)\s+20\d{2})/i)

    const city = cityM ? cityM[1].trim() : ""
    if (!city && prices.length === 0) continue

    communities.push({
      area: city ? city + ", FL" : "South Florida",
      city: city || "South Florida",
      zipCode: zipM ? zipM[1] : undefined,
      priceMin: prices[0],
      priceMax: prices.length > 1 ? prices[prices.length - 1] : undefined,
      bedrooms: bedM ? bedM[1].trim() : undefined,
      deliveryDate: dateM ? dateM[0] : undefined,
      description: chunk.trim().substring(0, 200),
      scrapedAt: now,
    })
  }

  const seen = new Set<string>()
  return communities.filter(function(c) {
    const k = c.city + "|" + c.priceMin
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

async function scrapePageWithPlaywright(
  page: any,
  url: string
): Promise<ScrapedCommunity[]> {
  const capturedHtml: string[] = []

  // Capture AJAX HTML responses from showingnew.com
  const handler = async (res: any) => {
    try {
      const resUrl: string = res.url()
      if (!resUrl.includes("showingnew.com")) return
      if (resUrl === url || resUrl === AGENT_URL) return
      if (/\.(css|js|png|jpg|gif|woff|ico|svg|webp)/i.test(resUrl)) return
      const ct: string = res.headers()["content-type"] || ""
      if (!ct.includes("html")) return
      const body = await res.text().catch(() => "")
      if (body.length > 200 && hasPriceOrCity(body)) {
        console.log("[ShowingNew] AJAX HTML: " + resUrl.substring(0, 80) + " (" + body.length + "b)")
        capturedHtml.push(body)
      }
    } catch (_) {}
  }
  page.on("response", handler)

  try {
    // Navigate
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

    // Use captured AJAX HTML if available (most reliable)
    for (let i = 0; i < capturedHtml.length; i++) {
      const found = parseFromVisibleText(capturedHtml[i].replace(/<[^>]+>/g, " ").replace(/\s+/g, " "))
      if (found.length > 0) return found
    }

    // Fall back to page visible text
    const visibleText: string = await page.evaluate(function() {
      return (document.body?.innerText || "").replace(/\s+/g, " ")
    }).catch(() => "") as string

    const fromText = parseFromVisibleText(visibleText)
    if (fromText.length > 0) return fromText

    console.log("[ShowingNew] " + url + " — text sample: " + visibleText.substring(0, 300))
    return []
  } finally {
    page.off("response", handler)
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
      return { communities: allCommunities, errors: [], strategy: "playwright-scroll" }
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
