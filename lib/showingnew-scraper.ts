/**
 * ShowingNew scraper — fetches new construction communities from the agent's
 * ShowingNew page (NewHomeSource Professional platform by BDX).
 *
 * The server requires an ASP.NET session cookie set by the homepage before
 * any AJAX endpoints return content. Strategy:
 * 1. Navigate to the homepage with Playwright (establishes session cookie)
 * 2. Fetch the BSXN endpoint within the page context (sends cookie automatically)
 * 3. Fall back to navigating to the communities page directly
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
const BSXN_PATH = "/catherinegomez/home/getbuildersection"
const COMMUNITIES_URL = "https://www.showingnew.com/catherinegomez/communities/florida/miami-dade-county"

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

/** Parse community cards from an HTML string using DOMParser in the browser context */
async function parseHtmlWithDom(page: any, html: string): Promise<ScrapedCommunity[]> {
  if (!html || html.length < 100) return []

  const raw = await page.evaluate((htmlStr: string) => {
    try {
      const doc = new DOMParser().parseFromString(htmlStr, "text/html")

      // Try progressively broader selectors — BDX/NewHomeSource uses Bootstrap grid
      const selectorSets = [
        "[class*='BSXN']", "[class*='bsxn']",
        "[class*='community-card']", "[class*='community-listing']",
        "[class*='community-result']", "[class*='plan-card']",
        "[class*='builder-card']", "[class*='listing-card']",
        ".col-xs-12.col-sm-6", ".col-sm-6", ".col-md-4",
        ".panel.panel-default", ".panel",
        "li[class]", "article",
      ]

      let cards: Element[] = []
      for (let i = 0; i < selectorSets.length; i++) {
        const found = Array.from(doc.querySelectorAll(selectorSets[i]))
        if (found.length >= 2) { cards = found; break }
      }
      // Fall back to body's direct children
      if (cards.length < 2 && doc.body && doc.body.children.length >= 2) {
        cards = Array.from(doc.body.children)
      }
      if (cards.length === 0 && doc.body) cards = [doc.body]

      return cards.map(function(card) {
        const text = (card.textContent || "").replace(/\s+/g, " ").trim()
        const img = card.querySelector("img") as HTMLImageElement | null
        const imgSrc = img ? (img.getAttribute("src") || img.getAttribute("data-src") || "") : ""

        // City, FL
        const cityM = text.match(/([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\s*,?\s*FL\b/)

        // Prices via exec loop (no matchAll — ES5 compat)
        const prices: number[] = []
        const priceRe = /\$\s*([\d,]+)/g
        let pm: RegExpExecArray | null
        while ((pm = priceRe.exec(text)) !== null) {
          const n = parseFloat(pm[1].replace(/,/g, ""))
          if (n >= 50000 && n <= 20000000) prices.push(n)
        }
        prices.sort(function(a, b) { return a - b })

        const bedM = text.match(/(\d+(?:\s*[-–]\s*\d+)?)\s*(?:Bed|bed|BD|BR)\b/i)
        const zipM = text.match(/\b(3[0-9]{4})\b/)
        const dateM = text.match(/(?:Q[1-4]\s*20\d{2}|(?:Spring|Summer|Fall|Winter)\s+20\d{2})/i)

        return {
          city: cityM ? cityM[1].trim() : "",
          prices: prices,
          beds: bedM ? bedM[1].trim() : "",
          zip: zipM ? zipM[1] : "",
          date: dateM ? dateM[0] : "",
          imgSrc: imgSrc,
          text: text.substring(0, 300),
        }
      }).filter(function(c: any) {
        return c.text.length > 30 && (c.city || c.prices.length > 0)
      })
    } catch (e) {
      return []
    }
  }, html)

  if (!raw || !(raw as any[]).length) return []

  const now = new Date().toISOString()
  const seen = new Set<string>()
  return (raw as any[]).map(r => ({
    area: r.city ? `${r.city}, FL` : "South Florida",
    city: r.city || "South Florida",
    zipCode: r.zip || undefined,
    priceMin: r.prices[0] || undefined,
    priceMax: r.prices.length > 1 ? r.prices[r.prices.length - 1] : undefined,
    bedrooms: r.beds || undefined,
    deliveryDate: r.date || undefined,
    imageUrl: r.imgSrc || undefined,
    description: r.text || undefined,
    scrapedAt: now,
  } as ScrapedCommunity)).filter(c => {
    const k = `${c.city}|${c.priceMin}`
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

    // ── Step 1: Navigate to homepage to establish ASP.NET session cookie ──
    console.log("[ShowingNew] Loading homepage to establish session…")
    try {
      await page.goto(AGENT_URL, { timeout: 40000, waitUntil: "networkidle" })
    } catch {
      try { await page.goto(AGENT_URL, { timeout: 30000, waitUntil: "load" }) } catch {}
    }
    await page.waitForTimeout(1500)

    // ── Step 2: Fetch BSXN endpoint within the browser (uses session cookie) ──
    console.log("[ShowingNew] Fetching BSXN endpoint with session cookie…")
    const bsxnResult = await page.evaluate(async (path: string) => {
      try {
        const res = await fetch(path, {
          method: "GET",
          headers: {
            "X-Requested-With": "XMLHttpRequest",
            "Accept": "text/html, */*; q=0.1",
          },
          credentials: "same-origin",
        })
        const html = await res.text()
        return { status: res.status, html, length: html.length }
      } catch (e: any) {
        return { status: 0, html: "", length: 0, error: e.message }
      }
    }, BSXN_PATH).catch(() => ({ status: 0, html: "", length: 0 })) as { status: number; html: string; length: number }

    console.log(`[ShowingNew] BSXN: ${bsxnResult.status}, ${bsxnResult.length}b`)

    if (bsxnResult.html && bsxnResult.length > 100) {
      const communities = await parseHtmlWithDom(page, bsxnResult.html)
      if (communities.length > 0) {
        console.log(`[ShowingNew] BSXN fetch → ${communities.length} communities`)
        return { communities, errors: [], strategy: "bsxn-in-browser" }
      }
    }

    // ── Step 3: Navigate to communities page (has session cookie now) ──
    console.log("[ShowingNew] Navigating to communities page…")
    try {
      await page.goto(COMMUNITIES_URL, { timeout: 35000, waitUntil: "networkidle" })
    } catch {
      try { await page.goto(COMMUNITIES_URL, { timeout: 25000, waitUntil: "load" }) } catch {}
    }
    await page.waitForTimeout(2000)

    const commHtml: string = await page.content().catch(() => "")
    if (commHtml.length > 500) {
      const communities = await parseHtmlWithDom(page, commHtml)
      if (communities.length > 0) {
        console.log(`[ShowingNew] Communities page → ${communities.length} communities`)
        return { communities, errors: [], strategy: "communities-page" }
      }
    }

    // ── Step 4: Also try fetching communities page in-page (same session) ──
    const commFetch = await page.evaluate(async (url: string) => {
      try {
        const res = await fetch(url, { credentials: "same-origin", headers: { Accept: "text/html,*/*" } })
        const html = await res.text()
        return { status: res.status, html, length: html.length }
      } catch (e: any) {
        return { status: 0, html: "", length: 0 }
      }
    }, COMMUNITIES_URL).catch(() => ({ status: 0, html: "", length: 0 })) as any

    if (commFetch.html && commFetch.length > 500) {
      const communities = await parseHtmlWithDom(page, commFetch.html)
      if (communities.length > 0) {
        console.log(`[ShowingNew] Communities fetch → ${communities.length} communities`)
        return { communities, errors: [], strategy: "communities-fetch" }
      }
    }

    const txt: string = await page.evaluate(() => (document.body?.innerText || "").substring(0, 500)).catch(() => "")
    console.log("[ShowingNew] All strategies failed. Page text:", txt)
    return { communities: [], errors: ["no communities found in any strategy"], strategy: "none" }

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
  return communities.filter(c => {
    const key = `${c.area}|${c.priceMin}|${c.bedrooms}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
