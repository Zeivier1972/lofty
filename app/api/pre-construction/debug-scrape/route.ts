export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getChromiumPath } from "@/lib/showingnew-scraper"

const AGENT_URL = "https://www.showingnew.com/catherinegomez"
const PAGES = [
  "https://www.showingnew.com/catherinegomez/homes/florida/miami-dade-county",
  "https://www.showingnew.com/catherinegomez/homes/florida/broward-county-ft.-lauderdale/",
  "https://www.showingnew.com/catherinegomez/communities/florida/miami-dade-county",
]

// Debug: visit each search page after establishing session; show visible text,
// which CSS selectors hit, and how many prices/cities are found.
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

    // Homepage → session
    try { await page.goto(AGENT_URL, { timeout: 35000, waitUntil: "networkidle" }) } catch {}
    await page.waitForTimeout(1000)

    const results: any[] = []

    for (const url of PAGES) {
      try { await page.goto(url, { timeout: 35000, waitUntil: "networkidle" }) } catch {
        try { await page.goto(url, { timeout: 25000, waitUntil: "load" }) } catch {}
      }
      await page.evaluate(function() { window.scrollTo(0, 600) }).catch(() => {})
      await page.waitForTimeout(3000)

      const info = await page.evaluate(function() {
        const sels = [
          "[class*='community']", "[class*='BSXN']", "[class*='search-result']",
          "[class*='listing']", "[class*='home-card']", "[class*='plan']",
          ".col-sm-6", ".col-md-4", ".col-md-3", ".col-lg-3", ".col-lg-4",
          ".panel.panel-default", ".panel", "li[class]", "article",
        ]
        const selectorHits: Record<string, number> = {}
        for (let i = 0; i < sels.length; i++) {
          try { selectorHits[sels[i]] = document.querySelectorAll(sels[i]).length } catch (_) {}
        }

        const text = (document.body?.innerText || "").replace(/\s+/g, " ")
        const priceRe = /\$\s*([\d,]+)/g
        const prices: string[] = []
        let pm: RegExpExecArray | null
        while ((pm = priceRe.exec(text)) !== null) prices.push(pm[1])

        const cityRe = /([A-Z][a-zA-Z-]+(?:\s+[A-Z][a-zA-Z-]+)*)\s*,?\s*FL\b/g
        const cities: string[] = []
        let cm: RegExpExecArray | null
        while ((cm = cityRe.exec(text)) !== null) cities.push(cm[1])

        return {
          title: document.title,
          url: window.location.href,
          selectorHits,
          visibleText: text.substring(0, 1000),
          priceCount: prices.length,
          prices: Array.from(new Set(prices)).slice(0, 20),
          cityCount: cities.length,
          cities: Array.from(new Set(cities)).slice(0, 20),
          bodyChildCount: document.body?.children.length || 0,
        }
      }).catch((e: any) => ({ error: e.message }))

      results.push({ url, ...info })
    }

    return NextResponse.json({ chromiumPath: executablePath, pages: results })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}
