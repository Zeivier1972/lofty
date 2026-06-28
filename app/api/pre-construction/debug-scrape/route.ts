export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

const AGENT_URL = "https://www.showingnew.com/catherinegomez"

// Debug endpoint: launches Playwright and returns what the browser actually sees
// Visit this URL while logged in to diagnose scraping issues
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let chromium: any
  try {
    chromium = require("playwright").chromium
  } catch {
    return NextResponse.json({ error: "playwright not installed" }, { status: 500 })
  }

  let browser: any = null
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
        "--disable-gpu", "--disable-blink-features=AutomationControlled",
      ],
    })

    const ctx = await browser.newContext({
      ignoreHTTPSErrors: true,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
    })
    const page = await ctx.newPage()

    const interceptedRequests: string[] = []
    const interceptedResponses: Array<{ url: string; status: number; ct: string; bodyPreview: string }> = []

    page.on("request", (req: any) => {
      const url: string = req.url()
      if (!url.includes("google") && !url.includes("analytics") && !url.includes("gtag") && !url.includes("font")) {
        interceptedRequests.push(`${req.method()} ${url.substring(0, 120)}`)
      }
    })

    page.on("response", async (res: any) => {
      try {
        const url: string = res.url()
        if (url.includes("google") || url.includes("analytics") || url.includes("font")) return
        const ct: string = res.headers()["content-type"] || ""
        if (ct.includes("json") || ct.includes("javascript")) {
          const body = await res.text().catch(() => "")
          interceptedResponses.push({
            url: url.substring(0, 120),
            status: res.status(),
            ct: ct.substring(0, 50),
            bodyPreview: body.substring(0, 300),
          })
        }
      } catch {}
    })

    // Navigate with generous timeout
    let navError = ""
    try {
      await page.goto(AGENT_URL, { timeout: 30000, waitUntil: "networkidle" })
    } catch (e: any) {
      navError = e?.message?.split("\n")[0] || ""
      // Try again with domcontentloaded
      try {
        await page.goto(AGENT_URL, { timeout: 20000, waitUntil: "domcontentloaded" })
      } catch {}
    }

    await page.waitForTimeout(5000)

    const title = await page.title().catch(() => "")
    const url = page.url()
    const html = await page.content().catch(() => "")

    // Extract all text from the page to see what's visible
    const visibleText = await page.evaluate(() => document.body?.innerText?.substring(0, 3000) || "").catch(() => "")

    return NextResponse.json({
      navError: navError || null,
      title,
      finalUrl: url,
      htmlLength: html.length,
      htmlPreview: html.substring(0, 4000),
      visibleText: visibleText,
      interceptedRequestCount: interceptedRequests.length,
      interceptedRequests: interceptedRequests.slice(0, 30),
      interceptedResponseCount: interceptedResponses.length,
      interceptedResponses: interceptedResponses.slice(0, 10),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}
