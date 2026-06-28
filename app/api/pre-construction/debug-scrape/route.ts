export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getChromiumPath } from "@/lib/showingnew-scraper"

const AGENT_URL = "https://www.showingnew.com/catherinegomez"
const COMMUNITIES_URL = "https://www.showingnew.com/catherinegomez/communities/florida/miami-dade-county"

// Debug: visit homepage (session), fetch communities page, show what we get.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let chromium: any
  try { chromium = require("playwright").chromium } catch {
    return NextResponse.json({ error: "playwright not installed" }, { status: 500 })
  }

  const executablePath = getChromiumPath()
  let browser: any = null
  try {
    browser = await chromium.launch({
      executablePath: executablePath || undefined,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    })
    const ctx = await browser.newContext({
      ignoreHTTPSErrors: true,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
    })
    const page = await ctx.newPage()

    // Step 1: homepage → session cookie
    try { await page.goto(AGENT_URL, { timeout: 35000, waitUntil: "networkidle" }) } catch {}
    await page.waitForTimeout(1000)

    // Step 2: fetch communities page with session cookie
    const result = await page.evaluate(async (url: string) => {
      try {
        const res = await fetch(url, {
          headers: { Accept: "text/html, */*", "Accept-Language": "en-US,en;q=0.9" },
          credentials: "same-origin",
        })
        const html = await res.text()

        // Count patterns to verify community data is in the HTML
        const priceRe = /\$\s*([\d,]+)/g
        let pm: RegExpExecArray | null
        const prices: string[] = []
        while ((pm = priceRe.exec(html)) !== null) prices.push(pm[1])

        const cityRe = /([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\s*,?\s*FL\b/g
        const cities: string[] = []
        let cm: RegExpExecArray | null
        while ((cm = cityRe.exec(html)) !== null) cities.push(cm[1])

        const imgRe = /akamaized\.net[^"'\s]*\.(?:jpg|png|webp)/gi
        const imgs = html.match(imgRe) || []

        // Try to find community cards with multiple selectors
        const doc = new DOMParser().parseFromString(html, "text/html")
        const selectorResults: Record<string, number> = {}
        const sels = [
          "[class*='community']", "[class*='BSXN']", "[class*='search-result']",
          "[class*='listing']", ".col-sm-6", ".col-md-4", ".col-md-3",
          ".panel", "li[class]", "article",
        ]
        for (let i = 0; i < sels.length; i++) {
          try { selectorResults[sels[i]] = doc.querySelectorAll(sels[i]).length } catch (_) {}
        }

        return {
          status: res.status,
          length: html.length,
          // Show body section (skip head)
          bodyPreview: (html.match(/<body[^>]*>([\s\S]{0,4000})/) || ["", ""])[1],
          priceCount: prices.length,
          uniquePrices: Array.from(new Set(prices)).slice(0, 20),
          cityCount: cities.length,
          uniqueCities: Array.from(new Set(cities)).slice(0, 20),
          imgCount: imgs.length,
          selectorHits: selectorResults,
        }
      } catch (e: any) {
        return { status: 0, error: e.message }
      }
    }, COMMUNITIES_URL)

    return NextResponse.json({ chromiumPath: executablePath, communities: result })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}
