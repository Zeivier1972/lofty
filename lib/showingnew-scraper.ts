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
  bathrooms?: string
  sqft?: number
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

// Injected before any page JS. Patches XHR + fetch to capture communityresults responses.
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

  /* ---- fetch ---- */
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
          }).catch(function() {});
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
 * Extract individual homes from json.Data (BDX getresultshomes response).
 * Returns each home as a ScrapedCommunity with exact price/beds/sqft.
 * Builder names, community names, and URLs are intentionally NOT stored.
 */
function extractHomesFromData(data: any, now: string): ScrapedCommunity[] {
  if (!data) return []

  // Data may be an array directly, or an object wrapping an array
  let arr: any[] = []
  if (Array.isArray(data)) {
    arr = data
  } else if (typeof data === "object") {
    console.log("[ShowingNew] Data keys: " + Object.keys(data).slice(0, 20).join(", "))
    arr = data.Homes || data.Plans || data.Results || data.Items || data.HomeList || []
  }

  if (arr.length === 0) return []

  // Log first item keys so we can verify field names
  const sample = arr[0] || {}
  console.log("[ShowingNew] Home item keys (" + arr.length + "): " + Object.keys(sample).slice(0, 30).join(", "))

  const results: ScrapedCommunity[] = []
  for (let i = 0; i < arr.length; i++) {
    const h = arr[i]
    if (!h) continue

    // City — try all known BDX field names
    const cityRaw: string = h.CityName || h.City || h.MarketCity || h.CityState || ""
    const city = typeof cityRaw === "string" ? cityRaw.split(",")[0].trim() : ""
    if (!city) continue

    // Price — individual home has a single price
    const price: number =
      h.BasePrice || h.Price || h.LowPrice || h.MinPrice ||
      h.StartingPrice || h.PriceFrom || h.SalesPrice || 0
    if (!price || price <= 0) continue

    // Beds
    const bedsMin: number = h.BdCount || h.Bedrooms || h.MinBedrooms || h.BedMin || h.BedsFrom || 0
    const bedsMax: number = h.MaxBedrooms || h.BedMax || h.BedsTo || 0
    let bedrooms: string | undefined
    if (bedsMin > 0) bedrooms = (bedsMax > bedsMin) ? bedsMin + "-" + bedsMax : String(bedsMin)

    // Bathrooms
    const baMin: number = h.BaCount || h.Bathrooms || h.MinBathrooms || h.BathMin || 0
    const baMax: number = h.MaxBathrooms || h.BathMax || 0
    let bathrooms: string | undefined
    if (baMin > 0) bathrooms = (baMax > baMin) ? baMin + "-" + baMax : String(baMin)

    // Sqft
    const sqft: number = h.Sqft || h.SqFt || h.SquareFeet || h.MinSqft || h.SftMin || h.SqftMin || 0

    // Delivery / move-in date
    const deliveryDate: string = h.MoveInDate || h.DeliveryDate || h.CompletionDate || h.ExpectedMoveIn || ""

    // Image — safe to show (no builder/community info)
    const imageUrl: string = h.ThumbnailUrl || h.ImageUrl || h.ThumbUrl || h.PhotoUrl || h.MainPhoto || ""

    // Zip code
    const zipCode: string = h.ZipCode || h.Zip || h.PostalCode || ""

    // Description is constructed — never uses builder/community name
    let description = city + ", FL new construction"
    if (bedsMin > 0) description += " · " + bedsMin + " bed"
    if (baMin > 0) description += "/" + baMin + " bath"
    if (sqft > 0) description += " · " + sqft.toLocaleString() + " sq ft"

    results.push({
      area: city + ", FL",
      city,
      zipCode: zipCode || undefined,
      priceMin: price,
      priceMax: price,
      bedrooms,
      bathrooms,
      sqft: sqft || undefined,
      deliveryDate: deliveryDate || undefined,
      description,
      imageUrl: imageUrl || undefined,
      scrapedAt: now,
    })
  }

  return results
}

/**
 * Fallback: derive area summary from FacetsCounts.Facets when Data is empty/unparseable.
 * Returns one entry per city in the search result with the aggregate price + bed range.
 */
function extractAreaSummary(json: any, pageUrl: string, now: string): ScrapedCommunity[] {
  const facetsCounts = json.FacetsCounts
  if (!facetsCounts) return []

  const filters = facetsCounts.Facets || facetsCounts

  let priceMin: number | undefined
  let priceMax: number | undefined
  const prRaw: string = filters.PrRange || filters.PriceRange || ""
  if (prRaw && prRaw.indexOf("-") !== -1) {
    const parts = prRaw.split("-")
    const lo = parseInt(parts[0] || "", 10)
    const hi = parseInt(parts[1] || "", 10)
    if (!isNaN(lo) && lo > 0) priceMin = lo
    if (!isNaN(hi) && hi > 0) priceMax = hi
  }
  if (!priceMin && !priceMax) return []

  let bedrooms: string | undefined
  const brRaw: string = filters.BrRange || ""
  if (brRaw && brRaw !== "-" && brRaw !== "0") bedrooms = brRaw.trim()

  const urlSegs = pageUrl.replace(/\/$/, "").split("/")
  const lastSeg = urlSegs[urlSegs.length - 1] || ""
  let areaLabel = lastSeg.replace(/^city-/, "").replace(/-/g, " ")
    .replace(/\b\w/g, function(l: string) { return l.toUpperCase() })
  if (!areaLabel) areaLabel = "South Florida"

  const cities: string[] = []
  const citiesArr: any[] = filters.Cities || []
  if (Array.isArray(citiesArr)) {
    for (let i = 0; i < citiesArr.length; i++) {
      const entry = citiesArr[i]
      const v: string = (typeof entry === "string") ? entry : (entry && (entry.Value || entry.Name || entry.City || ""))
      if (typeof v === "string" && v.trim()) cities.push(v.trim())
    }
  }

  if (cities.length === 0) {
    return [{ area: areaLabel + ", FL", city: areaLabel, priceMin, priceMax, bedrooms, description: areaLabel + " new construction homes", scrapedAt: now }]
  }
  return cities.map(function(city) {
    return { area: city + ", FL", city, priceMin, priceMax, bedrooms, description: city + " new construction homes", scrapedAt: now }
  })
}

interface ParsedPage {
  homes: ScrapedCommunity[]
  total: number
}

function parseResponseBody(body: string, pageUrl: string): ParsedPage {
  let json: any
  try { json = JSON.parse(body) } catch { return { homes: [], total: 0 } }

  const now = new Date().toISOString()
  const total: number = typeof json.Total === "number" ? json.Total : 0

  // Primary: individual homes from Data
  const homes = extractHomesFromData(json.Data, now)
  if (homes.length > 0) {
    console.log("[ShowingNew] Extracted " + homes.length + " homes (total=" + total + ")")
    return { homes, total }
  }

  // Fallback: area summary from FacetsCounts
  const summary = extractAreaSummary(json, pageUrl, now)
  console.log("[ShowingNew] Fallback area summary: " + summary.length + " entries")
  return { homes: summary, total: 0 }
}

/** Fetch additional pages of results from within the browser (same session cookies). */
async function fetchAdditionalPage(page: any, reqBody: string, pageNum: number): Promise<string | null> {
  // Patch both page fields in the request body (outer and inner)
  const patched = reqBody
    .replace(/"page"\s*:\s*\d+/, '"page":' + pageNum)
    .replace(/"PageNumber"\s*:\s*\d+/, '"PageNumber":' + pageNum)

  return page.evaluate(async function(body: string) {
    try {
      const r = await fetch("/catherinegomez/communityresults/getresultshomes", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: body,
      })
      return r.ok ? await r.text() : null
    } catch { return null }
  }, patched).catch(function() { return null })
}

async function scrapePageWithInterception(
  page: any,
  url: string,
): Promise<ScrapedCommunity[]> {
  try {
    // "load" only — "networkidle" can time out and trigger a second goto() which
    // resets window.__bdxCaptures, wiping captures already accumulated.
    try { await page.goto(url, { timeout: 45000, waitUntil: "load" }) } catch (e: any) {
      console.log("[ShowingNew] goto error on " + url + ": " + (e?.message || e))
    }

    // Progressive scroll to trigger lazy-load AJAX
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

    // Wait up to 12 s for captures
    try {
      await page.waitForFunction(
        function() { return Array.isArray((window as any).__bdxCaptures) && (window as any).__bdxCaptures.length > 0 },
        { timeout: 12000 }
      )
    } catch {}

    await page.waitForTimeout(800)

    const captures: Array<{ url: string; method: string; reqBody: string; status: number; body: string }> =
      await page.evaluate(function() { return (window as any).__bdxCaptures || [] }).catch(function() { return [] })

    console.log("[ShowingNew] JS captures: " + captures.length + " from " + url)

    for (let i = 0; i < captures.length; i++) {
      const cap = captures[i]
      // Only process getresultshomes / getresultscommunities — skip getpreviewimages
      if (cap.url.indexOf("getpreview") !== -1) continue
      if (cap.status !== 200 || !cap.body || cap.body.length < 50) continue

      console.log("[ShowingNew] Processing " + cap.method + " " + cap.url.substring(0, 80) + " len=" + cap.body.length)

      const parsed = parseResponseBody(cap.body, url)
      if (parsed.homes.length === 0) continue

      let allHomes = parsed.homes

      // Paginate to fetch all homes (cap at 150 per search page = ~7 pages)
      if (parsed.total > allHomes.length && cap.reqBody && cap.reqBody.indexOf('"page"') !== -1) {
        const pageSize = 20
        const totalPages = Math.min(Math.ceil(parsed.total / pageSize), 7)
        console.log("[ShowingNew] Paginating: total=" + parsed.total + " pages=" + totalPages)
        for (let p = 2; p <= totalPages; p++) {
          const moreBody = await fetchAdditionalPage(page, cap.reqBody, p)
          if (!moreBody) break
          const moreParsed = parseResponseBody(moreBody, url)
          if (moreParsed.homes.length === 0) break
          allHomes = allHomes.concat(moreParsed.homes)
          console.log("[ShowingNew] Page " + p + ": +" + moreParsed.homes.length + " homes (running=" + allHomes.length + ")")
        }
      }

      return allHomes
    }

    if (captures.filter(function(c) { return c.url.indexOf("getpreview") === -1 }).length === 0) {
      const title = await page.title().catch(function() { return "?" })
      console.log("[ShowingNew] No getresults captures. Title='" + title + "'")
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

    // Establish ASP.NET session cookie
    console.log("[ShowingNew] Homepage (session)…")
    try { await page.goto(AGENT_URL, { timeout: 30000, waitUntil: "load" }) } catch {}
    console.log("[ShowingNew] Homepage title: '" + (await page.title().catch(function() { return "?" })) + "'")
    await page.waitForTimeout(1000)

    const allHomes: ScrapedCommunity[] = []
    const seen = new Set<string>()

    for (let i = 0; i < SEARCH_PAGES.length; i++) {
      const url = SEARCH_PAGES[i]
      console.log("[ShowingNew] Scraping [" + (i + 1) + "/" + SEARCH_PAGES.length + "]: " + url)
      const found = await scrapePageWithInterception(page, url)
      console.log("[ShowingNew] Found " + found.length + " from " + url)
      for (let j = 0; j < found.length; j++) {
        // Dedup key: city + exact price + beds + sqft
        const key = found[j].city + "|" + found[j].priceMin + "|" + found[j].bedrooms + "|" + (found[j].sqft || "")
        if (!seen.has(key)) { seen.add(key); allHomes.push(found[j]) }
      }
    }

    if (allHomes.length > 0) {
      return { communities: allHomes, errors: [], strategy: "playwright-xhr" }
    }
    return { communities: [], errors: ["no homes on any page"], strategy: "none" }

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
    const k = c.city + "|" + c.priceMin + "|" + c.bedrooms + "|" + (c.sqft || "")
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
