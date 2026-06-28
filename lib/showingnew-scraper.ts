/**
 * ShowingNew scraper — fetches new construction communities from the agent's
 * ShowingNew page (NewHomeSource Professional platform by BDX).
 *
 * Strategy:
 * 1. Server-side HTTP fetch of the BSXN section endpoint (fast, no browser)
 * 2. Server-side HTTP fetch of the full communities page
 * 3. Playwright fallback navigating to the communities page
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

const BASE_URL = "https://www.showingnew.com"
const AGENT_SLUG = "catherinegomez"
const AGENT_URL = `${BASE_URL}/${AGENT_SLUG}`

// These URLs are derived from the agent's page (confirmed via debug-scrape):
// - BSXN endpoint: the AJAX call that loads community cards
// - Communities page: the "See All X Communities" href
const BSXN_URL = `${BASE_URL}/${AGENT_SLUG}/home/getbuildersection`
const COMMUNITIES_URL = `${BASE_URL}/${AGENT_SLUG}/communities/florida/miami-dade-county`

const FETCH_HEADERS = {
  "Accept": "text/html, */*; q=0.1",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  "Referer": AGENT_URL,
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "X-Requested-With": "XMLHttpRequest",
}

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

/** Server-side regex extraction from HTML — no browser needed */
function parseHtmlServerSide(html: string): ScrapedCommunity[] {
  if (!html || html.length < 200) return []
  const now = new Date().toISOString()
  const communities: ScrapedCommunity[] = []

  // Segment into candidate community blocks.
  // BDX/NewHomeSource uses repeating structural elements. Try to split on common delimiters.
  const delimiterPatterns = [
    // BDX class patterns
    /(?=<[^>]+class="[^"]*(?:community|builder|plan|listing)[^"]*")/gi,
    // Bootstrap column divs (each community = one column)
    /(?=<div[^>]+class="[^"]*col-(?:xs|sm|md|lg)-\d+[^"]*")/gi,
    // List items
    /(?=<li[\s>])/gi,
    // Articles
    /(?=<article[\s>])/gi,
  ]

  let segments: string[] = []
  for (const pat of delimiterPatterns) {
    const positions: number[] = []
    let m: RegExpExecArray | null
    const re = new RegExp(pat.source, "gi")
    while ((m = re.exec(html)) !== null) positions.push(m.index)
    if (positions.length >= 2) {
      for (let i = 0; i < positions.length; i++) {
        const seg = html.slice(positions[i], positions[i + 1] ?? html.length)
        if (seg.length > 100) segments.push(seg)
      }
      break
    }
  }
  // Fallback: treat entire response as one big block and extract all items
  if (segments.length === 0) segments = [html]

  for (const seg of segments) {
    // Strip HTML tags for text extraction
    const text = seg.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    if (text.length < 30) continue

    // City + FL
    const cityMatch = text.match(/([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\s*,?\s*FL\b/)
    const city = cityMatch ? cityMatch[1].trim() : ""

    // Prices
    const prices: number[] = []
    const priceRe = /\$\s*([\d,]+)/g
    let pm: RegExpExecArray | null
    while ((pm = priceRe.exec(text)) !== null) {
      const n = parseFloat(pm[1].replace(/,/g, ""))
      if (n >= 50000 && n <= 20000000) prices.push(n)
    }
    prices.sort((a, b) => a - b)

    if (!city && prices.length === 0) continue

    // Beds
    const bedMatch = text.match(/(\d+(?:\s*[-–]\s*\d+)?)\s*(?:Bed|bed|BD|BR)\b/i)

    // Zip (Florida: starts with 3)
    const zipMatch = text.match(/\b(3[0-9]{4})\b/)

    // Delivery date
    const dateMatch = text.match(/(?:Q[1-4]\s*20\d{2}|(?:Spring|Summer|Fall|Winter)\s+20\d{2}|20\d{2})/i)

    // Image (Akamai CDN)
    const imgMatch = seg.match(/https?:\/\/[^"'\s]+akamaized\.net[^"'\s]*\.(?:jpg|jpeg|png|webp)/i)
      || seg.match(/(?:src|data-src)="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i)

    communities.push({
      area: city ? `${city}, FL` : "South Florida",
      city: city || "South Florida",
      zipCode: zipMatch?.[1],
      priceMin: prices[0],
      priceMax: prices.length > 1 ? prices[prices.length - 1] : undefined,
      bedrooms: bedMatch?.[1]?.trim(),
      deliveryDate: dateMatch?.[0],
      imageUrl: imgMatch?.[1] || imgMatch?.[0],
      description: text.substring(0, 200) || undefined,
      scrapedAt: now,
    })
  }

  // Deduplicate
  const seen = new Set<string>()
  return communities.filter(c => {
    const k = `${c.city}|${c.priceMin}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** Direct server-side HTTP fetch — no browser, no Playwright */
async function tryDirectFetch(): Promise<{ communities: ScrapedCommunity[]; strategy: string }> {
  const urls = [BSXN_URL, COMMUNITIES_URL]
  for (const url of urls) {
    try {
      console.log(`[ShowingNew] Direct fetch: ${url}`)
      const res = await fetch(url, { headers: FETCH_HEADERS })
      if (!res.ok) { console.log(`[ShowingNew] ${url} → ${res.status}`); continue }
      const html = await res.text()
      console.log(`[ShowingNew] ${url} → ${html.length}b`)
      if (html.length < 200) continue
      const communities = parseHtmlServerSide(html)
      console.log(`[ShowingNew] Parsed ${communities.length} communities from ${url}`)
      if (communities.length > 0) return { communities, strategy: `direct:${url.replace(BASE_URL, "")}` }
    } catch (e: any) {
      console.warn(`[ShowingNew] fetch ${url} failed:`, e?.message)
    }
  }
  return { communities: [], strategy: "" }
}

/** Playwright fallback: navigate directly to the communities page */
async function scrapeWithPlaywright(): Promise<{ communities: ScrapedCommunity[]; strategy: string }> {
  let chromium: any
  try { chromium = require("playwright").chromium } catch {
    console.warn("[ShowingNew] playwright not available")
    return { communities: [], strategy: "" }
  }
  const executablePath = getChromiumPath()
  if (!executablePath) return { communities: [], strategy: "" }

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--no-first-run"],
  }).catch((e: any) => { console.error("[ShowingNew] launch failed:", e?.message); return null })
  if (!browser) return { communities: [], strategy: "" }

  try {
    const ctx = await browser.newContext({
      ignoreHTTPSErrors: true,
      userAgent: FETCH_HEADERS["User-Agent"],
      viewport: { width: 1280, height: 900 },
      extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
    })
    const page = await ctx.newPage()

    // Navigate directly to the communities page
    console.log(`[ShowingNew] Playwright → ${COMMUNITIES_URL}`)
    try {
      await page.goto(COMMUNITIES_URL, { timeout: 40000, waitUntil: "networkidle" })
    } catch {
      try { await page.goto(COMMUNITIES_URL, { timeout: 30000, waitUntil: "load" }) } catch {}
    }
    await page.waitForTimeout(3000)

    const html: string = await page.content().catch(() => "")
    if (html.length > 500) {
      // Use DOMParser inside the browser for reliable card detection
      const raw = await page.evaluate((htmlStr: string) => {
        try {
          const doc = new DOMParser().parseFromString(htmlStr, "text/html")
          const sels = [
            "[class*='community']", "[class*='builder']", "[class*='plan']",
            "[class*='listing']", "[class*='BSXN']", "[class*='bsxn']",
            ".panel", "article", "li[class]", ".col-sm-6", ".col-md-4",
          ]
          let cards: Element[] = []
          for (const sel of sels) {
            const found = Array.from(doc.querySelectorAll(sel))
            if (found.length >= 2) { cards = found; break }
          }
          if (cards.length < 2 && doc.body?.children.length >= 2) cards = Array.from(doc.body.children)
          if (!cards.length && doc.body) cards = [doc.body]
          return cards.map(c => {
            const t = (c.textContent || "").replace(/\s+/g, " ").trim()
            const img = c.querySelector("img") as HTMLImageElement | null
            const prices: number[] = []
            const re = /\$\s*([\d,]+)/g; let pm: any
            while ((pm = re.exec(t))) { const n = parseFloat(pm[1].replace(/,/g, "")); if (n >= 50000 && n <= 20_000_000) prices.push(n) }
            prices.sort((a: number, b: number) => a - b)
            return {
              city: (t.match(/([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\s*,?\s*FL\b/) || [])[1]?.trim() || "",
              prices,
              beds: (t.match(/(\d+(?:\s*[-–]\s*\d+)?)\s*(?:Bed|bed|BD|BR)\b/i) || [])[1]?.trim() || "",
              zip: (t.match(/\b(3[0-9]{4})\b/) || [])[1] || "",
              date: (t.match(/(?:Q[1-4]\s*20\d{2}|(?:Spring|Summer|Fall|Winter)\s+20\d{2})/i) || [])[0] || "",
              imgSrc: img?.getAttribute("src") || img?.getAttribute("data-src") || "",
              text: t.substring(0, 250),
            }
          }).filter((c: any) => c.text.length > 30 && (c.city || c.prices.length > 0))
        } catch { return [] }
      }, html).catch(() => []) as any[]

      const now = new Date().toISOString()
      const seen = new Set<string>()
      const communities = (raw as any[]).map(r => ({
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

      if (communities.length > 0) {
        console.log(`[ShowingNew] Playwright → ${communities.length} communities`)
        return { communities, strategy: "playwright-communities-page" }
      }
    }

    const txt = await page.evaluate(() => (document.body?.innerText || "").substring(0, 500)).catch(() => "")
    console.log("[ShowingNew] Playwright found nothing. Page text:", txt)
    return { communities: [], strategy: "" }
  } catch (e: any) {
    console.warn("[ShowingNew] Playwright error:", e?.message?.split("\n")[0])
    return { communities: [], strategy: "" }
  } finally {
    await browser.close().catch(() => {})
  }
}

export async function scrapeShowingNew(): Promise<{
  communities: ScrapedCommunity[]
  errors: string[]
  strategy: string
}> {
  const errors: string[] = []

  // Strategy 1: Direct HTTP (fastest — no browser)
  const direct = await tryDirectFetch().catch((e: any) => {
    errors.push(`direct: ${e?.message}`)
    return { communities: [] as ScrapedCommunity[], strategy: "" }
  })
  if (direct.communities.length > 0) {
    return { communities: dedup(direct.communities), errors, strategy: direct.strategy }
  }

  // Strategy 2: Playwright → communities page
  const pw = await scrapeWithPlaywright().catch((e: any) => {
    errors.push(`playwright: ${e?.message}`)
    return { communities: [] as ScrapedCommunity[], strategy: "" }
  })
  return {
    communities: dedup(pw.communities),
    errors,
    strategy: pw.strategy || "none",
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
