/**
 * ShowingNew scraper — fetches new construction communities from the agent's
 * ShowingNew page (NewHomeSource Professional platform by BDX).
 *
 * Communities load via HTML AJAX (AjaxHelper.load + IntersectionObserver) into
 * #home-builders. The AJAX URL lives in the page's JS config as `getBSXN`.
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

/** Parse community cards from HTML using DOMParser in the browser context */
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
        "[class*='listing-item']",
        ".panel.panel-default",
        ".panel",
        "li[class]",
        "article",
        ".col-xs-12.col-sm-6",
        ".col-md-4",
        ".col-sm-6",
      ]

      let cards: Element[] = []
      for (const sel of selectorCandidates) {
        try {
          const found = Array.from(doc.querySelectorAll(sel))
          if (found.length >= 2) { cards = found; break }
        } catch {}
      }

      // Fall back to direct body children
      if (cards.length < 2 && doc.body && doc.body.children.length >= 2) {
        cards = Array.from(doc.body.children)
      }
      if (cards.length === 0 && doc.body) {
        cards = [doc.body]
      }

      return cards.map(card => {
        const text = (card.textContent || "").replace(/\s+/g, " ").trim()
        const imgEl = card.querySelector("img") as HTMLImageElement | null
        const imgSrc = imgEl
          ? (imgEl.getAttribute("src") || imgEl.getAttribute("data-src") || imgEl.getAttribute("data-lazy") || "")
          : ""

        const cityMatch = text.match(/([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\s*,?\s*FL\b/)

        const prices: number[] = []
        const dollarRe = /\$\s*([\d,]+)/g
        let pm: RegExpExecArray | null
        while ((pm = dollarRe.exec(text)) !== null) {
          const n = parseFloat(pm[1].replace(/,/g, ""))
          if (n >= 50000 && n <= 20000000) prices.push(n)
        }
        prices.sort((a: number, b: number) => a - b)

        const bedMatch = text.match(/(\d+(?:\s*[-–]\s*\d+)?)\s*(?:Bed|bed|BD|BR)\b/i)
        const zipMatch = text.match(/\b(3[0-9]{4})\b/)
        const dateMatch = text.match(/(?:Q[1-4]\s*20\d{2}|(?:Spring|Summer|Fall|Winter)\s+20\d{2}|20\d{2})/i)

        return {
          city: cityMatch ? cityMatch[1].trim() : "",
          prices,
          beds: bedMatch ? bedMatch[1].trim() : "",
          zip: zipMatch ? zipMatch[1] : "",
          date: dateMatch ? dateMatch[0] : "",
          imgSrc,
          textSample: text.substring(0, 300),
        }
      }).filter((c: any) => c.textSample.length > 30 && (c.city || c.prices.length > 0))
    } catch {
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
      // Capture the getBSXN URL when AjaxHelper.load is called
      ;(window as any).__ajaxUrls = []
      const origXHROpen = XMLHttpRequest.prototype.open
      XMLHttpRequest.prototype.open = function(method: string, url: string) {
        if (url && !url.includes(window.location.origin + window.location.pathname)) {
          (window as any).__ajaxUrls.push(url)
        }
        return origXHROpen.apply(this, arguments as any)
      }
    })

    const page = await ctx.newPage()

    // Capture ALL responses from showingnew.com (communities come as HTML, not JSON)
    const capturedBodies: Array<{ url: string; body: string }> = []
    page.on("response", async (res: any) => {
      try {
        const url: string = res.url()
        if (!url.includes("showingnew.com")) return
        if (url === AGENT_URL || url.startsWith(AGENT_URL + "#")) return
        if (url.includes(".js") || url.includes(".css") || url.match(/\.(png|jpg|gif|woff|ico)/)) return

        const body = await res.text().catch(() => "")
        if (body.length > 200) {
          console.log(`[ShowingNew] AJAX response: ${url.substring(0, 100)} (${body.length}b)`)
          capturedBodies.push({ url, body })
        }
      } catch {}
    })

    // Navigate — use networkidle so all scripts run (IntersectionObserver gets set up)
    console.log("[ShowingNew] Navigating…")
    try {
      await page.goto(AGENT_URL, { timeout: 40000, waitUntil: "networkidle" })
    } catch {
      try { await page.goto(AGENT_URL, { timeout: 30000, waitUntil: "load" }) } catch {}
    }

    // Scroll #home-builders into view to trigger the IntersectionObserver
    await page.evaluate(() => {
      const hb = document.getElementById("home-builders")
      if (hb) {
        hb.scrollIntoView({ behavior: "instant", block: "center" })
      } else {
        window.scrollTo(0, Math.min(600, document.body.scrollHeight / 2))
      }
      window.dispatchEvent(new Event("scroll"))
    }).catch(() => {})

    // Wait for #home-builders to get meaningful content
    const populated = await page.waitForFunction(
      () => {
        const el = document.getElementById("home-builders")
        return el && el.innerHTML.trim().length > 300
      },
      { timeout: 20000 }
    ).then(() => true).catch(() => false)

    await page.waitForTimeout(2000)

    if (populated) {
      console.log("[ShowingNew] #home-builders populated")
    } else {
      console.log("[ShowingNew] #home-builders not populated — trying fallbacks")
    }

    // ── Strategy 1: Extract getBSXN URL from multiple sources and fetch ──
    const bsxnUrl: string | null = await page.evaluate(() => {
      // Check XHR URLs we intercepted via prototype patch
      const ajaxUrls: string[] = (window as any).__ajaxUrls || []
      const ajaxHit = ajaxUrls.find(u => u.includes("showingnew.com") || u.includes("newhomesource.com"))
      if (ajaxHit) return ajaxHit

      // Search window-level objects for getBSXN
      try {
        const w = window as any
        if (w.getBSXN && typeof w.getBSXN === "string") return w.getBSXN
        for (const key of Object.keys(w)) {
          try {
            const obj = w[key]
            if (obj && typeof obj === "object" && typeof obj.getBSXN === "string") return obj.getBSXN
          } catch {}
        }
      } catch {}

      // Search inline script textContent
      const patterns = [
        /"getBSXN"\s*:\s*"([^"]+)"/,
        /'getBSXN'\s*:\s*'([^']+)'/,
        /getBSXN\s*:\s*["']([^"']+)["']/,
        /getBSXN\s*=\s*["']([^"']+)["']/,
      ]
      for (const s of Array.from(document.querySelectorAll("script"))) {
        const text = (s as HTMLScriptElement).textContent || ""
        for (const p of patterns) {
          const m = text.match(p)
          if (m?.[1]?.startsWith("http")) return m[1]
        }
      }
      return null
    }).catch(() => null)

    console.log(`[ShowingNew] getBSXN URL: ${bsxnUrl || "not found"}`)

    if (bsxnUrl) {
      const ajaxHtml: string = await page.evaluate(async (url: string) => {
        try {
          const res = await fetch(url, {
            headers: {
              "X-Requested-With": "XMLHttpRequest",
              "Accept": "text/html, */*",
            },
            credentials: "same-origin",
          })
          return await res.text()
        } catch { return "" }
      }, bsxnUrl).catch(() => "")

      if (ajaxHtml && ajaxHtml.length > 200) {
        console.log(`[ShowingNew] getBSXN response: ${ajaxHtml.length}b`)
        const communities = await parseHtmlWithDom(page, ajaxHtml)
        if (communities.length > 0) {
          console.log(`[ShowingNew] Strategy 1 (getBSXN) → ${communities.length}`)
          return communities
        }
      }
    }

    // ── Strategy 2: Captured AJAX responses ──
    for (const { url, body } of capturedBodies) {
      const communities = await parseHtmlWithDom(page, body)
      if (communities.length > 0) {
        console.log(`[ShowingNew] Strategy 2 (captured from ${url.substring(0, 60)}) → ${communities.length}`)
        return communities
      }
    }

    // ── Strategy 3: DOM extraction from #home-builders ──
    const homeBuilderHtml: string = await page.evaluate(() => {
      return document.getElementById("home-builders")?.innerHTML || ""
    }).catch(() => "")

    if (homeBuilderHtml.length > 200) {
      const communities = await parseHtmlWithDom(page, homeBuilderHtml)
      if (communities.length > 0) {
        console.log(`[ShowingNew] Strategy 3 (DOM) → ${communities.length}`)
        return communities
      }
    }

    // ── Strategy 4: Click "See All" then re-extract ──
    const seeAllUrl: string | null = await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll("a, button"))
      const el = allLinks.find(e => {
        const t = (e.textContent || "").toLowerCase()
        return t.includes("see all") || t.includes("view all") || t.includes("all communities")
      }) as HTMLAnchorElement | HTMLButtonElement | undefined
      if (!el) return null
      ;(el as HTMLElement).click()
      return (el as HTMLAnchorElement).href || null
    }).catch(() => null)

    if (seeAllUrl) {
      console.log(`[ShowingNew] Clicked See All, href: ${seeAllUrl}`)
    }

    await page.waitForTimeout(3000)

    // After click, try to extract from the updated DOM
    const afterClickHtml: string = await page.evaluate(() => {
      return document.getElementById("home-builders")?.innerHTML || document.body.innerHTML || ""
    }).catch(() => "")

    const afterClickCommunities = await parseHtmlWithDom(page, afterClickHtml)
    if (afterClickCommunities.length > 0) {
      console.log(`[ShowingNew] Strategy 4 (See All) → ${afterClickCommunities.length}`)
      return afterClickCommunities
    }

    // ── Strategy 5: If there's a See All href, navigate to it ──
    if (seeAllUrl && seeAllUrl.startsWith("http") && seeAllUrl !== AGENT_URL) {
      try {
        await page.goto(seeAllUrl, { timeout: 20000, waitUntil: "networkidle" })
        await page.waitForTimeout(2000)
        const subpageHtml: string = await page.evaluate(() => document.body.innerHTML || "").catch(() => "")
        const subCommunities = await parseHtmlWithDom(page, subpageHtml)
        if (subCommunities.length > 0) {
          console.log(`[ShowingNew] Strategy 5 (See All page) → ${subCommunities.length}`)
          return subCommunities
        }
      } catch {}
    }

    // ── Strategy 6: Full page ──
    const fullHtml: string = await page.content().catch(() => "")
    const fullCommunities = await parseHtmlWithDom(page, fullHtml)
    if (fullCommunities.length > 0) {
      console.log(`[ShowingNew] Strategy 6 (full page) → ${fullCommunities.length}`)
      return fullCommunities
    }

    const txt: string = await page.evaluate(() => (document.body?.innerText || "").substring(0, 1000)).catch(() => "")
    console.log(`[ShowingNew] All strategies failed. Page text: ${txt}`)
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
