export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getChromiumPath } from "@/lib/showingnew-scraper"

const AGENT_URL = "https://www.showingnew.com/catherinegomez"
const SEARCH_PAGES = [
  "https://www.showingnew.com/catherinegomez/homes/florida/miami-dade-county",
  "https://www.showingnew.com/catherinegomez/homes/florida/broward-county-ft.-lauderdale/",
]

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

    // Session
    try { await page.goto(AGENT_URL, { timeout: 30000, waitUntil: "networkidle" }) } catch {}
    await page.waitForTimeout(800)

    const pages: any[] = []

    for (let i = 0; i < SEARCH_PAGES.length; i++) {
      const url = SEARCH_PAGES[i]
      const capturedAjax: Array<{ url: string; length: number; preview: string }> = []

      page.on("response", async (res: any) => {
        try {
          const resUrl: string = res.url()
          if (!resUrl.includes("showingnew.com")) return
          if (/\.(css|js|png|jpg|gif|woff|ico|svg|webp)/i.test(resUrl)) return
          if (resUrl === url || resUrl === AGENT_URL) return
          const body = await res.text().catch(() => "")
          if (body.length > 100) {
            capturedAjax.push({ url: resUrl, length: body.length, preview: body.substring(0, 1000) })
          }
        } catch (_) {}
      })

      try { await page.goto(url, { timeout: 35000, waitUntil: "networkidle" }) } catch {
        try { await page.goto(url, { timeout: 25000, waitUntil: "load" }) } catch {}
      }

      // Progressive scroll
      await page.evaluate(function() {
        return new Promise<void>(function(resolve) {
          let pos = 0
          const id = setInterval(function() {
            window.scrollTo(0, pos)
            window.dispatchEvent(new Event("scroll"))
            pos += 300
            if (pos > 3000) { clearInterval(id); resolve() }
          }, 200)
        })
      }).catch(() => {})

      await page.waitForTimeout(3000)

      const info = await page.evaluate(function() {
        const text = (document.body?.innerText || "").replace(/\s+/g, " ")
        // Count listings-like patterns
        const priceRe = /\$\s*([\d,]+)/g
        const prices: string[] = []
        let pm: RegExpExecArray | null
        while ((pm = priceRe.exec(text)) !== null) prices.push(pm[1])
        const cityRe = /([A-Z][a-zA-Z-]+(?:\s+[A-Z][a-zA-Z-]+)*)\s*,?\s*FL\b/g
        const cities: string[] = []
        let cm: RegExpExecArray | null
        while ((cm = cityRe.exec(text)) !== null) cities.push(cm[1])
        // First 2000 chars of BODY html to see structure
        const bodyHtml = document.body ? document.body.innerHTML.substring(0, 2000) : ""
        return {
          title: document.title,
          visibleText: text.substring(0, 1500),
          priceCount: prices.length,
          prices: Array.from(new Set(prices)).slice(0, 20),
          cityCount: cities.length,
          cities: Array.from(new Set(cities)).slice(0, 20),
          bodyHtmlPreview: bodyHtml,
        }
      }).catch(() => ({}))

      pages.push({ url, ...info, capturedAjax })
    }

    return NextResponse.json({ chromiumPath: executablePath, pages })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}
