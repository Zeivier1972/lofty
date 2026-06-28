/**
 * ShowingNew scraper — fetches new construction communities from the agent's
 * ShowingNew page (NewHomeSource Professional platform by BDX).
 *
 * Communities load via HTML AJAX (AjaxHelper.load) into #home-builders.
 * The AJAX URL is stored in the page's JS config as the `getBSXN` parameter.
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
  console.error("[ShowingNew] No Chromium found")
  return null
}

/** Extract community data from an HTML string using DOMParser inside browser context */
async function parseHtmlWithDom(page: any, html: string): Promise<ScrapedCommunity[]> {
  if (!html || html.length < 100) return []

  const raw = await page.evaluate((htmlStr: string) => {
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(htmlStr, "text/html")

      // Try progressively broader selectors to find repeating community card elements
      const selectorCandidates = [
        "[class*='BSXN']",
        "[class*='bsxn']",
        "[class*='community-card']",
        "[class*='community-listing']",
        "[class*='community-result']",
        "[class*='plan-card']",
        "[class*='plan-listing']",
        "[class*='builder-card']",
        "[class*='builder-listing']",
        "[class*='home-card']",
        "[class*='listing-card']",
        ".panel.panel-default",
        ".panel",
        "li[class]",
        "article",
        "[class*='col-'][class*='result']",
      ]

      let cards: Element[] = []
      for (const sel of selectorCandidates) {
        try {
          const found = Array.from(doc.querySelectorAll(sel))
          // Need at least 2 matches to be meaningful (avoid selecting the container itself)
          if (found.length >= 2) {
            cards = found
            break
          }
        } catch {}
      }

      // If no repeating pattern, try body's direct children
      if (cards.length < 2 && doc.body && doc.body.children.length >= 2) {
        cards = Array.from(doc.body.children)
      }

      // If still nothing, use body as a single card
      if (cards.length === 0 && doc.body) {
        cards = [doc.body]
      }

      return cards.map(card => {
        const text = (card.textContent || "").replace(/\s+/g, " ").trim()

        // Resolve image src — in DOMParser context, relative URLs stay relative
        const imgEl = card.querySelector("img") as HTMLImageElement | null
        const imgSrc = imgEl
          ? (imgEl.getAttribute("src") || imgEl.getAttribute("data-src") || imgEl.getAttribute("data-lazy") || "")
          : ""

        // City + FL (allow multi-word cities like "Fort Lauderdale")
        const cityMatch = text.match(/([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\s*,?\s*FL\b/)

        // All dollar prices
        const prices: number[] = []
        const dollarRe = /\$\s*([\d,]+)/g
        let pm: RegExpExecArray | null
        while ((pm = dollarRe.exec(text)) !== null) {
          const n = parseFloat(pm[1].replace(/,/g, ""))
          if (n >= 50000 && n <= 20000000) prices.push(n)
        }
        prices.sort((a, b) => a - b)

        // Beds
        const bedMatch = text.match(/(\d+(?:\s*[-–]\s*\d+)?)\s*(?:Bed|bed|BD|BR)\b/i)

        // Zip code (Florida zips start with 3)
        const zipMatch = text.match(/\b(3[0-9]{4})\b/)

        // Delivery / completion date
        const dateMatch = text.match(
          /(?:Q[1-4]\s*20\d{2}|(?:Spring|Summer|Fall|Winter)\s+20\d{2}|20\d{2})/i
        )

        return {
          city: cityMatch ? cityMatch[1].trim() : "",
          prices,
          beds: bedMatch ? bedMatch[1].trim() : "",
          zip: zipMatch ? zipMatch[1] : "",
          date: dateMatch ? dateMatch[0] : "",
          imgSrc,
          textSample: text.substring(0, 300),
        }
      }).filter(c => c.textSample.length > 30 && (c.city || c.prices.length > 0))
    } catch (err) {
      return []
    }
  }, html)

  if (!raw || raw.length === 0) return []

  const now = new Date().toISOString()
  const communities: ScrapedCommunity[] = (raw as any[]).map(r => ({
    area: r.city ? `${r.city}, FL` : "South Florida",
    city: r.city || "South Florida",
    zipCode: r.zip || undefined,
    priceMin: r.prices[0] || undefined,
    priceMax: r.prices.length > 1 ? r.prices[r.prices.length - 1] : undefined,
    bedrooms: r.beds || undefined,
    deliveryDate: r.date || undefined,
    imageUrl: r.imgSrc || undefined,
    description: r.textSample || undefined,
    scrapedAt: now,
  }))

  // Deduplicate: same city + priceMin = same community
  const seen = new Set<string>()
  return communities.filter(c => {
    const k = `${c.city}|${c.priceMin}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

async function scrapeWithPlaywright(): Promise<ScrapedCommunity[]> {
  let chromium: any
  try { chromium = require("playwright").chromium } catch {
    console.warn("[ShowingNew] playwright not available"); return []
  }

  const executablePath = getChromiumPath()
  if (!executablePath) return []

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: [
      "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
      "--disable-gpu", "--no-first-run",
      "--disable-blink-features=AutomationControlled",
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
      extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
    })
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined })
    })

    const page = await ctx.newPage()

    // Track all AJAX responses from showingnew.com
    const capturedHtmlBodies: Array<{ url: string; body: string }> = []
    const capturedAjaxUrls: string[] = []

    page.on("response", async (res: any) => {
      try {
        const url: string = res.url()
        if (!url.includes("showingnew.com")) return
        if (url === AGENT_URL) return
        if (url.includes("google") || url.includes("analytics") || url.includes("clarity")) return

        capturedAjaxUrls.push(url)

        const ct: string = res.headers()["content-type"] || ""
        if (ct.includes("html")) {
          const body = await res.text().catch(() => "")
          if (body.length > 300) {
            console.log(`[ShowingNew] Captured AJAX HTML: ${url.substring(0, 120)} (${body.length}b)`)
            capturedHtmlBodies.push({ url, body })
          }
        }
      } catch {}
    })

    // Navigate to the page
    console.log("[ShowingNew] Loading page…")
    try {
      await page.goto(AGENT_URL, { timeout: 35000, waitUntil: "domcontentloaded" })
    } catch (e: any) {
      console.warn("[ShowingNew] goto error:", e?.message?.split("\n")[0])
    }

    // Scroll down to trigger lazy-loading of community cards
    await page.evaluate(() => {
      window.scrollTo(0, 600)
      window.dispatchEvent(new Event("scroll"))
    }).catch(() => {})
    await page.waitForTimeout(1500)

    // Wait for #home-builders to populate
    await page.waitForFunction(
      () => {
        const el = document.getElementById("home-builders")
        return el && el.innerHTML.trim().length > 200
      },
      { timeout: 18000 }
    ).catch(() => console.log("[ShowingNew] #home-builders did not populate within 18s"))

    await page.waitForTimeout(2000)

    // ── Strategy 1: Extract getBSXN URL from page scripts and fetch it directly ──
    const bsxnUrl: string | null = await page.evaluate(() => {
      const patterns = [
        /"getBSXN"\s*:\s*"([^"]+)"/,
        /'getBSXN'\s*:\s*'([^']+)'/,
        /getBSXN\s*:\s*["']([^"']+)["']/,
        /getBSXN\s*=\s*["']([^"']+)["']/,
        /AjaxHelper\.load\([^,]+,\s*["']([^"']+)["']/,
        /AjaxHelper\.load\([^,]+,\s*(\w+)\.getBSXN/,  // t.getBSXN - won't give URL but signals presence
      ]
      const scripts = Array.from(document.querySelectorAll("script"))
      for (const s of scripts) {
        const text = s.textContent || s.innerText || ""
        for (const p of patterns) {
          const m = text.match(p)
          if (m?.[1]?.startsWith("http")) return m[1]
        }
      }
      // Also check window-level vars
      try {
        const w = window as any
        if (w.getBSXN && typeof w.getBSXN === "string") return w.getBSXN
        if (w.siteConfig?.getBSXN) return w.siteConfig.getBSXN
        if (w.initParams?.getBSXN) return w.initParams.getBSXN
        if (w.config?.getBSXN) return w.config.getBSXN
      } catch {}
      return null
    }).catch(() => null)

    console.log(`[ShowingNew] getBSXN URL: ${bsxnUrl || "not found"}`)

    if (bsxnUrl) {
      // Fetch the getBSXN URL from within the page (same origin = no CORS)
      const ajaxHtml: string = await page.evaluate(async (url: string) => {
        try {
          const res = await fetch(url, {
            headers: {
              "X-Requested-With": "XMLHttpRequest",
              "Accept": "text/html, */*; q=0.1",
            },
            credentials: "same-origin",
          })
          return await res.text()
        } catch { return "" }
      }, bsxnUrl).catch(() => "")

      if (ajaxHtml && ajaxHtml.length > 300) {
        console.log(`[ShowingNew] getBSXN HTML: ${ajaxHtml.length}b`)
        const communities = await parseHtmlWithDom(page, ajaxHtml)
        if (communities.length > 0) {
          console.log(`[ShowingNew] Strategy 1 (getBSXN fetch) → ${communities.length} communities`)
          return communities
        }
      }
    }

    // ── Strategy 2: Try captured AJAX HTML bodies ──
    for (const { url, body } of capturedHtmlBodies) {
      const communities = await parseHtmlWithDom(page, body)
      if (communities.length > 0) {
        console.log(`[ShowingNew] Strategy 2 (captured AJAX from ${url.substring(0, 80)}) → ${communities.length} communities`)
        return communities
      }
    }

    // ── Strategy 3: Re-fetch any showingnew.com AJAX URLs we captured ──
    for (const ajaxUrl of capturedAjaxUrls.filter(u => !u.includes(".js") && !u.includes(".css") && !u.includes(".png") && !u.includes(".jpg"))) {
      const refetchHtml: string = await page.evaluate(async (url: string) => {
        try {
          const res = await fetch(url, {
            headers: { "X-Requested-With": "XMLHttpRequest", "Accept": "text/html,*/*" },
            credentials: "same-origin",
          })
          const ct = res.headers.get("content-type") || ""
          if (!ct.includes("html")) return ""
          return await res.text()
        } catch { return "" }
      }, ajaxUrl).catch(() => "")

      if (refetchHtml && refetchHtml.length > 300) {
        const communities = await parseHtmlWithDom(page, refetchHtml)
        if (communities.length > 0) {
          console.log(`[ShowingNew] Strategy 3 (re-fetch ${ajaxUrl.substring(0, 80)}) → ${communities.length} communities`)
          return communities
        }
      }
    }

    // ── Strategy 4: Extract from current #home-builders DOM ──
    const homeBuilderHtml: string = await page.evaluate(() => {
      const el = document.getElementById("home-builders")
      return el ? el.innerHTML : ""
    }).catch(() => "")

    if (homeBuilderHtml && homeBuilderHtml.length > 200) {
      console.log(`[ShowingNew] #home-builders HTML: ${homeBuilderHtml.length}b`)
      const communities = await parseHtmlWithDom(page, homeBuilderHtml)
      if (communities.length > 0) {
        console.log(`[ShowingNew] Strategy 4 (DOM) → ${communities.length} communities`)
        return communities
      }
    }

    // ── Strategy 5: Click "See All" button then re-extract ──
    const clickedSeeAll = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll("a, button"))
      const btn = all.find(el => {
        const text = (el.textContent || "").toLowerCase()
        return text.includes("see all") || text.includes("view all") || text.includes("all communities")
      }) as HTMLElement | undefined
      if (btn) { btn.click(); return true }
      return false
    }).catch(() => false)

    if (clickedSeeAll) {
      console.log("[ShowingNew] Clicked 'See All' — waiting for content…")
      await page.waitForTimeout(3000)
      const afterClickHtml: string = await page.evaluate(() => {
        const el = document.getElementById("home-builders")
        return el ? el.innerHTML : document.body.innerHTML
      }).catch(() => "")
      const communities = await parseHtmlWithDom(page, afterClickHtml)
      if (communities.length > 0) {
        console.log(`[ShowingNew] Strategy 5 (See All click) → ${communities.length} communities`)
        return communities
      }
    }

    // ── Strategy 6: Full page DOM as last resort ──
    const fullHtml: string = await page.content().catch(() => "")
    if (fullHtml) {
      const communities = await parseHtmlWithDom(page, fullHtml)
      if (communities.length > 0) {
        console.log(`[ShowingNew] Strategy 6 (full page) → ${communities.length} communities`)
        return communities
      }
    }

    const txt: string = await page.evaluate(() => (document.body?.innerText || "").substring(0, 800)).catch(() => "")
    console.log(`[ShowingNew] No communities found. Page text: ${txt}`)
    return []

  } catch (e: any) {
    console.warn("[ShowingNew] scrape error:", e?.message?.split("\n")[0])
    return []
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
  const results = await scrapeWithPlaywright().catch((e: any) => {
    errors.push(e?.message || "unknown error")
    return [] as ScrapedCommunity[]
  })

  return {
    communities: dedup(results),
    errors,
    strategy: results.length > 0 ? "playwright-dom" : "none",
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
