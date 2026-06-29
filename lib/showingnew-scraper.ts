/**
 * ShowingNew scraper — NewHomeSource Professional platform by BDX.
 *
 * Injects XHR + fetch interception via addInitScript so it runs
 * before any page JavaScript, capturing communityresults response bodies.
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

// Injected before any page JS. Patches XHR + fetch to store communityresults response bodies.
// Broad match on 'communityresults' so we catch any variant URL (getresultshomes, etc.).
// Also captures the request body so we can replay if needed.
// Uses old-style JS (no arrow functions, no const) for maximum compatibility.
const CAPTURE_SCRIPT = `(function() {
  window.__bdxCaptures = [];

  /* ---- XMLHttpRequest (jQuery / ASP.NET UpdatePanel) ---- */
  var _open = XMLHttpRequest.prototype.open;
  var _send = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this._bdxUrl = String(url || '');
    this._bdxMethod = String(method || '');
    return _open.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function(body) {
    var self = this;
    if (self._bdxUrl && self._bdxUrl.toLowerCase().indexOf('communityresults') !== -1) {
      self._bdxReqBody = (typeof body === 'string') ? body : '';
      self.addEventListener('load', function() {
        try {
          window.__bdxCaptures.push({
            url: self._bdxUrl,
            method: self._bdxMethod,
            reqBody: self._bdxReqBody,
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
      if (url && url.toLowerCase().indexOf('communityresults') !== -1) {
        p = p.then(function(response) {
          var clone = response.clone();
          clone.text().then(function(text) {
            window.__bdxCaptures.push({ url: url, method: 'fetch', reqBody: '', status: response.status, body: text });
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
 *
 * Tries multiple JSON structures since BDX response shapes vary:
 *   1. FacetsCounts.Cities[] + PrRange + BrRange (original assumption)
 *   2. Communities[] array with per-community city/price/beds fields
 *   3. Homes[] / Plans[] array, grouped by city
 *
 * Builder names and community names are intentionally NOT stored.
 */
function parseGetResultsHomesJson(body: string, pageUrl: string): ScrapedCommunity[] {
  let json: any
  try { json = JSON.parse(body) } catch { return [] }

  const topKeys = Object.keys(json || {})
  console.log("[ShowingNew] JSON top-level keys: " + topKeys.join(", "))

  const now = new Date().toISOString()

  // Derive area label from page URL
  const urlSegs = pageUrl.replace(/\/$/, "").split("/")
  const lastSeg = urlSegs[urlSegs.length - 1] || ""
  let areaLabel = lastSeg.replace(/^city-/, "").replace(/-/g, " ")
    .replace(/\b\w/g, function(l: string) { return l.toUpperCase() })
  if (!areaLabel) areaLabel = "South Florida"

  // ── Strategy 1: FacetsCounts.Facets (actual BDX structure) ──────────────
  // PrRange and BrRange live inside FacetsCounts.Facets, NOT directly in FacetsCounts.
  const facetsCounts = json.FacetsCounts
  if (facetsCounts) {
    console.log("[ShowingNew] FacetsCounts keys (" + Object.keys(facetsCounts).length + "): " + Object.keys(facetsCounts).slice(0, 20).join(", "))
    const filters = facetsCounts.Facets || facetsCounts
    if (facetsCounts.Facets) {
      console.log("[ShowingNew] FacetsCounts.Facets keys (" + Object.keys(filters).length + "): " + Object.keys(filters).slice(0, 30).join(", "))
    }

    let priceMin: number | undefined
    let priceMax: number | undefined
    const prRaw: string = filters.PrRange || filters.PriceRange || filters.MinMaxPrice || ""
    if (prRaw && typeof prRaw === "string" && prRaw.indexOf("-") !== -1) {
      const parts = prRaw.split("-")
      const lo = parseInt(parts[0] || "", 10)
      const hi = parseInt(parts[1] || "", 10)
      if (!isNaN(lo) && lo > 0) priceMin = lo
      if (!isNaN(hi) && hi > 0) priceMax = hi
    } else if (typeof filters.MinPrice === "number" && filters.MinPrice > 0) {
      priceMin = filters.MinPrice
      priceMax = typeof filters.MaxPrice === "number" ? filters.MaxPrice : undefined
    }

    let bedrooms: string | undefined
    const brRaw: string = filters.BrRange || filters.BdRange || filters.BedroomRange || ""
    if (brRaw && typeof brRaw === "string") bedrooms = brRaw.trim()

    // Try Cities list from filters (might exist further in JSON)
    const cities: string[] = []
    const citiesArr: any[] = filters.Cities || filters.CityList || []
    if (Array.isArray(citiesArr)) {
      for (let i = 0; i < citiesArr.length; i++) {
        const entry = citiesArr[i]
        const v: string = (typeof entry === "string") ? entry : (entry && (entry.Value || entry.Name || entry.City || ""))
        if (typeof v === "string" && v.trim()) cities.push(v.trim())
      }
    }

    console.log("[ShowingNew] Parsed → priceMin=" + priceMin + " priceMax=" + priceMax + " bedrooms=" + bedrooms + " cities=" + cities.length)

    // Even with no city list, if we have price data, return one result using URL-derived area.
    // Each search URL is already scoped to a specific city or county.
    if (priceMin || priceMax || bedrooms) {
      if (cities.length === 0) {
        return [{ area: areaLabel + ", FL", city: areaLabel, priceMin, priceMax, bedrooms, description: areaLabel + " new construction homes", scrapedAt: now }]
      }
      return cities.map(function(city) {
        return { area: city + ", FL", city, priceMin, priceMax, bedrooms, description: city + " new construction homes", scrapedAt: now }
      })
    }
  }

  // ── Strategy 2: Communities / Homes array ────────────────────────────────
  const listKeys = ["Communities", "Homes", "Results", "SearchResults", "Items", "Plans", "HomeList", "CommunityList"]
  for (let li = 0; li < listKeys.length; li++) {
    const arr: any[] = json[listKeys[li]]
    if (!Array.isArray(arr) || arr.length === 0) continue

    const firstItem = arr[0] || {}
    const itemKeys = Object.keys(firstItem)
    console.log("[ShowingNew] Found json." + listKeys[li] + " length=" + arr.length + " item keys: " + itemKeys.slice(0, 25).join(", "))

    // Group by city, aggregate price + bed ranges
    const byCity = new Map<string, { priceMin: number; priceMax: number; bedsMin: number; bedsMax: number }>()
    for (let i = 0; i < arr.length; i++) {
      const c = arr[i]
      if (!c) continue

      // City — try various field names
      const cityRaw: string = c.CityName || c.City || c.CityStateZip || c.Location || c.Area || ""
      const city = typeof cityRaw === "string" ? cityRaw.split(",")[0].trim() : ""
      if (!city) continue

      const minP: number = c.MinPrice || c.PriceFrom || c.BasePrice || c.StartingPrice || c.LowPrice || 0
      const maxP: number = c.MaxPrice || c.PriceTo || c.HighPrice || c.TopPrice || 0
      const minBr: number = c.MinBedrooms || c.BedMin || c.BedsFrom || c.MinBeds || c.Bedrooms || 0
      const maxBr: number = c.MaxBedrooms || c.BedMax || c.BedsTo || c.MaxBeds || 0

      const prev = byCity.get(city)
      if (!prev) {
        byCity.set(city, { priceMin: minP, priceMax: maxP, bedsMin: minBr, bedsMax: maxBr })
      } else {
        byCity.set(city, {
          priceMin: (prev.priceMin && minP) ? Math.min(prev.priceMin, minP) : (prev.priceMin || minP),
          priceMax: Math.max(prev.priceMax, maxP),
          bedsMin: (prev.bedsMin && minBr) ? Math.min(prev.bedsMin, minBr) : (prev.bedsMin || minBr),
          bedsMax: Math.max(prev.bedsMax, maxBr),
        })
      }
    }

    console.log("[ShowingNew] Strategy2 → " + byCity.size + " cities")

    if (byCity.size > 0) {
      const results: ScrapedCommunity[] = []
      byCity.forEach(function(stats, city) {
        let bedrooms: string | undefined
        if (stats.bedsMin && stats.bedsMax && stats.bedsMin !== stats.bedsMax) bedrooms = stats.bedsMin + "-" + stats.bedsMax
        else if (stats.bedsMin) bedrooms = String(stats.bedsMin)
        results.push({
          area: city + ", FL",
          city,
          priceMin: stats.priceMin || undefined,
          priceMax: stats.priceMax || undefined,
          bedrooms,
          description: city + " new construction homes",
          scrapedAt: now,
        })
      })
      return results
    }
  }

  // Nothing worked — show more of the body for diagnostics
  console.log("[ShowingNew] Parse failed. Body[0..1000]: " + body.substring(0, 1000))
  return []
}

async function scrapePageWithInterception(
  page: any,
  url: string,
): Promise<ScrapedCommunity[]> {
  try {
    // Use "load" only — "networkidle" can time out and trigger a second goto() which
    // resets window.__bdxCaptures, wiping captures already accumulated.
    try { await page.goto(url, { timeout: 45000, waitUntil: "load" }) } catch (e: any) {
      console.log("[ShowingNew] goto load error on " + url + ": " + (e?.message || e))
    }

    // Progressive scroll to trigger IntersectionObserver / lazy-load AJAX
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
    }).catch(function() {})

    // Wait up to 12 s for the XHR/fetch hook to fire
    try {
      await page.waitForFunction(
        function() { return Array.isArray((window as any).__bdxCaptures) && (window as any).__bdxCaptures.length > 0 },
        { timeout: 12000 }
      )
    } catch {
      // timeout — no captures yet; check anyway
    }

    // Extra buffer for in-flight fetch clones to resolve
    await page.waitForTimeout(800)

    const captures: Array<{ url: string; method: string; reqBody: string; status: number; body: string }> =
      await page.evaluate(function() { return (window as any).__bdxCaptures || [] }).catch(function() { return [] })

    console.log("[ShowingNew] JS captures: " + captures.length + " from " + url)

    for (let i = 0; i < captures.length; i++) {
      const cap = captures[i]
      console.log("[ShowingNew] Capture[" + i + "] " + cap.method + " " + cap.url.substring(0, 80) + " status=" + cap.status + " len=" + (cap.body || "").length + " reqBodyLen=" + (cap.reqBody || "").length)
      if (cap.reqBody && cap.reqBody.length > 0) {
        console.log("[ShowingNew] Capture[" + i + "] reqBody: " + cap.reqBody.substring(0, 300))
      }
      if (cap.status === 200 && cap.body && cap.body.length >= 50) {
        const found = parseGetResultsHomesJson(cap.body, url)
        if (found.length > 0) {
          console.log("[ShowingNew] Parsed " + found.length + " cities from " + url)
          return found
        }
      }
    }

    if (captures.length === 0) {
      const title = await page.title().catch(function() { return "?" })
      const bodyPreview: string = await page.evaluate(function() {
        return document.body ? document.body.innerText.replace(/\s+/g, " ").substring(0, 300) : ""
      }).catch(function() { return "" })
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
  }).catch(function(e: any) { console.error("[ShowingNew] launch failed:", e?.message); return null })
  if (!browser) return { communities: [], errors: ["browser launch failed"], strategy: "none" }

  try {
    const ctx = await browser.newContext({
      ignoreHTTPSErrors: true,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
      extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
    })

    await ctx.addInitScript("Object.defineProperty(navigator,'webdriver',{get:()=>false})")
    await ctx.addInitScript(CAPTURE_SCRIPT)

    const page = await ctx.newPage()

    // Establish ASP.NET session cookie by visiting the agent homepage first
    console.log("[ShowingNew] Homepage (session)…")
    try { await page.goto(AGENT_URL, { timeout: 30000, waitUntil: "load" }) } catch {}
    const homeTitle = await page.title().catch(function() { return "?" })
    console.log("[ShowingNew] Homepage title: '" + homeTitle + "'")
    await page.waitForTimeout(1000)

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
    await browser.close().catch(function() {})
  }
}

export async function scrapeShowingNew(): Promise<{
  communities: ScrapedCommunity[]
  errors: string[]
  strategy: string
}> {
  const result = await scrapeWithPlaywright().catch(function(e: any) {
    return {
      communities: [] as ScrapedCommunity[],
      errors: [e?.message || "unknown"],
      strategy: "none",
    }
  })
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
