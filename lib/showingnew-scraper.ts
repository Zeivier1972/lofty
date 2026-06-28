/**
 * ShowingNew scraper — fetches new construction communities from the agent's
 * ShowingNew page (NewHomeSource Professional platform by BDX).
 *
 * The ASP.NET server requires a session cookie (set by the homepage) before
 * search pages return content. /home/getbuildersection always returns empty.
 *
 * Strategy:
 * 1. Visit homepage → establish ASP.NET session cookie
 * 2. Navigate to homes search page (user-confirmed URL) → extract from live DOM
 * 3. Navigate to communities page as fallback
 *
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

// All county/region search pages confirmed by the agent
const SEARCH_PAGES = [
  "https://www.showingnew.com/catherinegomez/homes/florida/miami-dade-county",
  "https://www.showingnew.com/catherinegomez/homes/florida/broward-county-ft.-lauderdale/",
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

/** In-page extraction function — runs inside Playwright browser, returns raw data */
function makeExtractor() {
  return function() {
    const sels = [
      "[class*='community']", "[class*='BSXN']", "[class*='bsxn']",
      "[class*='search-result']", "[class*='listing']",
      "[class*='home-card']", "[class*='plan-card']",
      ".col-sm-6", ".col-md-4", ".col-md-3", ".col-lg-4", ".col-lg-3",
      ".panel.panel-default", ".panel",
      "li[class]", "article",
    ]
    let cards: Element[] = []
    for (let i = 0; i < sels.length; i++) {
      try {
        const found = Array.from(document.querySelectorAll(sels[i]))
        if (found.length >= 2) { cards = found; break }
      } catch (_) {}
    }
    if (!cards.length) cards = Array.from(document.body ? document.body.children : [])

    return cards.map(function(card) {
      const text = (card.textContent || "").replace(/\s+/g, " ").trim()
      const img = card.querySelector("img") as HTMLImageElement | null

      // City: allow hyphens (Miami-Dade, Cutler Bay, etc.)
      const cityM = text.match(/([A-Z][a-zA-Z-]+(?:\s+[A-Z][a-zA-Z-]+)*)\s*,?\s*FL\b/)

      const prices: number[] = []
      const priceRe = /\$\s*([\d,]+)/g
      let pm: RegExpExecArray | null
      while ((pm = priceRe.exec(text)) !== null) {
        const n = parseFloat(pm[1].replace(/,/g, ""))
        if (n >= 50000 && n <= 20000000) prices.push(n)
      }
      prices.sort(function(a, b) { return a - b })

      const bedM   = text.match(/(\d+(?:\s*[-–]\s*\d+)?)\s*(?:Bed|bed|BD|BR)\b/i)
      const zipM   = text.match(/\b(3[0-9]{4})\b/)
      const dateM  = text.match(/(?:Q[1-4]\s*20\d{2}|(?:Spring|Summer|Fall|Winter)\s+20\d{2})/i)
      const imgSrc = img ? (img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-lazy") || "") : ""

      return {
        city:   cityM ? cityM[1].trim() : "",
        prices: prices,
        beds:   bedM  ? bedM[1].trim()  : "",
        zip:    zipM  ? zipM[1]         : "",
        date:   dateM ? dateM[0]        : "",
        imgSrc: imgSrc,
        text:   text.substring(0, 300),
      }
    }).filter(function(c: any) {
      // Accept if has city OR price (don't require both)
      return c.text.length > 30 && (c.city || c.prices.length > 0)
    })
  }
}

function rawToScrapedCommunities(raw: any[]): ScrapedCommunity[] {
  const now = new Date().toISOString()
  const seen = new Set<string>()
  return raw.map(function(r) {
    return {
      area:         r.city ? r.city + ", FL" : "South Florida",
      city:         r.city || "South Florida",
      zipCode:      r.zip   || undefined,
      priceMin:     r.prices[0] || undefined,
      priceMax:     r.prices.length > 1 ? r.prices[r.prices.length - 1] : undefined,
      bedrooms:     r.beds  || undefined,
      deliveryDate: r.date  || undefined,
      imageUrl:     r.imgSrc || undefined,
      description:  r.text  || undefined,
      scrapedAt:    now,
    } as ScrapedCommunity
  }).filter(function(c) {
    const k = c.city + "|" + c.priceMin
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
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

    // ── Step 1: Homepage → establishes ASP.NET session cookie ──
    console.log("[ShowingNew] Homepage (session)…")
    try { await page.goto(AGENT_URL, { timeout: 35000, waitUntil: "networkidle" }) } catch {
      try { await page.goto(AGENT_URL, { timeout: 25000, waitUntil: "load" }) } catch {}
    }
    await page.waitForTimeout(1000)

    const extractor = makeExtractor()

    // ── Step 2: Try each county search page ──
    for (const url of SEARCH_PAGES) {
      const label = url.replace("https://www.showingnew.com/catherinegomez/", "")
      console.log(`[ShowingNew] Navigating to ${label} page…`)
      try { await page.goto(url, { timeout: 35000, waitUntil: "networkidle" }) } catch {
        try { await page.goto(url, { timeout: 25000, waitUntil: "load" }) } catch {}
      }
      // Scroll to trigger any lazy loading
      await page.evaluate(function() { window.scrollTo(0, Math.min(800, document.body.scrollHeight / 2)) }).catch(() => {})
      await page.waitForTimeout(3000)

      const raw = await page.evaluate(extractor).catch(() => []) as any[]
      console.log(`[ShowingNew] ${label}: ${raw.length} raw cards`)

      if (raw.length > 0) {
        const communities = rawToScrapedCommunities(raw)
        if (communities.length > 0) {
          console.log("[ShowingNew] " + label + " → " + communities.length + " communities")
          return { communities, errors: [], strategy: label }
        }
      }

      const txt = await page.evaluate(function() { return (document.body?.innerText || "").substring(0, 400) }).catch(() => "")
      console.log("[ShowingNew] " + label + " text: " + txt)
    }

    return { communities: [], errors: ["no communities found on any page"], strategy: "none" }

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

function dedup(communities: ScrapedCommunity[]): ScrapedCommunity[] {
  const seen = new Set<string>()
  return communities.filter(function(c) {
    const key = c.area + "|" + c.priceMin + "|" + c.bedrooms
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
