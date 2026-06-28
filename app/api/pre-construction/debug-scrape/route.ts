export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getChromiumPath } from "@/lib/showingnew-scraper"

const AGENT_URL = "https://www.showingnew.com/catherinegomez"
const BSXN_PATH = "/catherinegomez/home/getbuildersection"
const COMMUNITIES_URL = "https://www.showingnew.com/catherinegomez/communities/florida/miami-dade-county"

// Debug endpoint: navigates to ShowingNew homepage, then fetches BSXN endpoint
// with the session cookie — shows raw HTML so we can see the community structure.
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

    // 1. Navigate to homepage → establishes ASP.NET session cookie
    let navError = ""
    try {
      await page.goto(AGENT_URL, { timeout: 40000, waitUntil: "networkidle" })
    } catch (e: any) {
      navError = e?.message?.split("\n")[0] || ""
      try { await page.goto(AGENT_URL, { timeout: 25000, waitUntil: "load" }) } catch {}
    }
    await page.waitForTimeout(1500)

    // 2. Fetch BSXN endpoint with session cookies
    const bsxn = await page.evaluate(async (path: string) => {
      try {
        const r = await fetch(path, {
          method: "GET",
          headers: { "X-Requested-With": "XMLHttpRequest", "Accept": "text/html, */*" },
          credentials: "same-origin",
        })
        const html = await r.text()
        return { status: r.status, html, length: html.length }
      } catch (e: any) {
        return { status: 0, html: "", length: 0, error: e.message }
      }
    }, BSXN_PATH)

    // 3. Fetch communities page with session cookies
    const communities = await page.evaluate(async (url: string) => {
      try {
        const r = await fetch(url, {
          headers: { Accept: "text/html, */*" },
          credentials: "same-origin",
        })
        const html = await r.text()
        return { status: r.status, html: html.substring(0, 3000), length: html.length }
      } catch (e: any) {
        return { status: 0, html: "", length: 0, error: e.message }
      }
    }, COMMUNITIES_URL)

    return NextResponse.json({
      chromiumPath: executablePath,
      navError: navError || null,
      homepageTitle: await page.title().catch(() => ""),
      bsxn: {
        path: BSXN_PATH,
        status: (bsxn as any).status,
        length: (bsxn as any).length,
        preview: (bsxn as any).html?.substring(0, 3000) || "",
        error: (bsxn as any).error || null,
      },
      communities: {
        url: COMMUNITIES_URL,
        status: (communities as any).status,
        length: (communities as any).length,
        preview: (communities as any).html || "",
        error: (communities as any).error || null,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}
