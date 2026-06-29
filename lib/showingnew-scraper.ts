/**
 * ShowingNew scraper — NewHomeSource Professional platform by BDX.
 *
 * Injects XHR + fetch interception via addInitScript so it runs
 * before any page JavaScript, capturing getresultshomes response bodies.
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

// Injected before any page JS. Patches XHR + fetch to store getresultshomes bodies.
// Uses old-style JS (no arrow functions, no const) for maximum compatibility.
const CAPTURE_SCRIPT = `(function() {
  window.__bdxCaptures = [];

  /* ---- XMLHttpRequest (jQuery / ASP.NET UpdatePanel) ---- */
  var _open = XMLHttpRequest.prototype.open;
  var _send = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this._bdxUrl = String(url || '');
    return _open.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function(body) {
    var self = this;
    if (self._bdxUrl && self._bdxUrl.toLowerCase().indexOf('getresultshomes') !== -1) {
      self.addEventListener('load', function() {
        try {
          window.__bdxCaptures.push({
            url: self._bdxUrl,
            status: self.status,
            body: self.responseText
          });
          console.log('[BDX-HOOK] XHR captured url=' + self._bdxUrl + ' len=' + self.responseText.length);
        } catch(e) {}
      });
      self.addEventListener('error', function() {
        console.log('[BDX-HOOK] XHR error on ' + self._bdxUrl);
      });
    }
    return _send.apply(this, arguments);
  };

  /* ---- fetch (modern pattern) ---- */
  if (typeof window.fetch === 'function') {
    var _fetch = window.fetch;
    window.fetch = function(input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var p = _fetch.apply(this, arguments);
      if (url && url.toLowerCase().indexOf('getresultshomes') !== -1) {
        p = p.then(function(response) {
          var clone = response.clone();
          clone.text().then(function(text) {
            window.__bdxCaptures.push({ url: url, status: response.status, body: text });
            console.log('[BDX-HOOK] fetch captured url=' + url + ' len=' + text.length);
          }).catch(function(e) {
            console.log('[BDX-HOOK] fetch clone error: ' + e);
          });
          return response;
        });
      }
      return p;
    };
  }

  console.log('[BDX-HOOK] XHR+fetch interception installed');
})();`

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

async function scrapePageWithInterception(
  page: any,
  url: string,
): Promise<ScrapedCommunity[]> {
  try {
    try { await page.goto(url, { timeout: 35000, waitUntil: "networkidle" }) } catch {
      try { await page.goto(url, { timeout: 25000, waitUntil: "load" }) } catch {}
    }

    // Progressive scroll to trigger IntersectionObserver / lazy load AJAX
    await page.evaluate(function() {
      return new Promise<void>(function(resolve) {
        let pos = 0
        const step = 300
        const max = Math.min(document.body.scrollHeight, 5000)
        const id = setInterval(function() {
          window.scrollTo(0, pos)
          window.dispatchEvent(new Event("scroll"))
          pos += step
          if (pos > max) { clearInterval(id); window.scrollTo(0, 0); resolve() }
        }, 120)
      })
    }).catch(() => {})

    // Wait up to 8 s for the XHR/fetch hook to fire, or fall through
    try {
      await page.waitForFunction(
        function() { return Array.isArray((window as any).__bdxCaptures) && (window as any).__bdxCaptures.length > 0 },
        { timeout: 8000 }
      )
    } catch {
      // timeout — no captures yet, will check anyway
    }

    // Extra 1-second buffer for in-flight fetch clones to resolve
    await page.waitForTimeout(1000)

    const captures: Array<{ url: string; status: number; body: string }> =
      await page.evaluate(function() { return (window as any).__bdxCaptures || [] }).catch(() => [])

    console.log("[ShowingNew] JS captures: " + captures.length + " from " + url)

    for (let i = 0; i < captures.length; i++) {
      const cap = captures[i]
      console.log("[ShowingNew] Capture[" + i + "] url=" + cap.url.substring(0, 80) + " status=" + cap.status + " len=" + (cap.body || "").length)
      if (cap.status === 200 && cap.body && cap.body.length >= 50) {
        const found = parseGetResultsHomesJson(cap.body, url)
        if (found.length > 0) {
          console.log("[ShowingNew] Parsed " + found.length + " cities from " + url)
          return found
        }
        console.log("[ShowingNew] Body ok but no cities/prices; preview: " + cap.body.substring(0, 200))
      }
    }

    if (captures.length === 0) {
      const title = await page.title().catch(() => "?")
      const bodyPreview: string = await page.evaluate(function() {
        return document.body ? document.body.innerText.replace(/\s+/g, " ").substring(0, 250) : ""
      }).catch(() => "")
      console.log("[ShowingNew] No captures. Title='" + title + "' body='" + bodyPreview + "'")
    }

    return []
  } catch (e: any) {
    console.log("[ShowingNew] scrapePageWithInterception error on " + url + ": " + (e?.message || e))
    return []
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
    args: [
      "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
      "--disable-gpu", "--no-first-run",
      "--disable-blink-features=AutomationControlled",
    ],
  }).catch((e: any) => { console.error("[ShowingNew] launch failed:", e?.message); return null })
  if (!browser) return { communities: [], errors: ["browser launch failed"], strategy: "none" }

  try {
    const ctx = await browser.newContext({
      ignoreHTTPSErrors: true,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
      extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
    })

    // Mask navigator.webdriver to avoid bot detection
    await ctx.addInitScript("Object.defineProperty(navigator,'webdriver',{get:()=>false})")

    // Install XHR + fetch interceptor — runs before any page JavaScript
    await ctx.addInitScript(CAPTURE_SCRIPT)

    const page = await ctx.newPage()

    // Establish ASP.NET session cookie by visiting the agent homepage first
    console.log("[ShowingNew] Homepage (session)…")
    try { await page.goto(AGENT_URL, { timeout: 30000, waitUntil: "networkidle" }) } catch {
      try { await page.goto(AGENT_URL, { timeout: 20000, waitUntil: "load" }) } catch {}
    }
    const homeTitle = await page.title().catch(() => "?")
    console.log("[ShowingNew] Homepage title: '" + homeTitle + "'")
    await page.waitForTimeout(800)

    const allCommunities: ScrapedCommunity[] = []
    const seen = new Set<string>()

    for (let i = 0; i < SEARCH_PAGES.length; i++) {
      const url = SEARCH_PAGES[i]
      console.log("[ShowingNew] Scraping [" + (i + 1) + "/" + SEARCH_PAGES.length + "]: " + url)
      const found = await scrapePageWithInterception(page, url)
      console.log("[ShowingNew] Found " + found.length + " from " + url)
      for (let j = 0; j < found.length; j++) {
        const key = found[j].city + "|" + found[j].priceMin
        if (!seen.has(key)) { seen.add(key); allCommunities.push(found[j]) }
      }
    }

    if (allCommunities.length > 0) {
      return { communities: allCommunities, errors: [], strategy: "playwright-xhr" }
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
