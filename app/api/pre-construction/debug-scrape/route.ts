export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getChromiumPath } from "@/lib/showingnew-scraper"

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

  const executablePath = getChromiumPath()
  let browser: any = null
  try {
    browser = await chromium.launch({
      executablePath: executablePath || undefined,
      headless: true,
      args: [
        "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
        "--disable-gpu", "--disable-blink-features=AutomationControlled",
      ],
    })

    const ctx = await browser.newContext({
      ignoreHTTPSErrors: true,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
    })

    // Intercept XHR before page scripts run
    await ctx.addInitScript(() => {
      ;(window as any).__ajaxUrls = []
      const origOpen = XMLHttpRequest.prototype.open
      XMLHttpRequest.prototype.open = function(method: string, url: string) {
        (window as any).__ajaxUrls.push(`XHR ${method} ${url}`)
        return origOpen.apply(this, arguments as any)
      }
    })

    const page = await ctx.newPage()

    // Capture ALL responses from showingnew.com
    const capturedResponses: Array<{ url: string; status: number; ct: string; bodyPreview: string; bodyLength: number }> = []
    const capturedRequests: string[] = []

    page.on("request", (req: any) => {
      const url: string = req.url()
      if (!url.includes("google") && !url.includes("analytics") && !url.includes("font")) {
        capturedRequests.push(`${req.method()} ${url.substring(0, 120)}`)
      }
    })

    page.on("response", async (res: any) => {
      try {
        const url: string = res.url()
        if (url.includes("google") || url.includes("analytics") || url.includes("font")) return
        const ct: string = res.headers()["content-type"] || ""
        const body = await res.text().catch(() => "")
        capturedResponses.push({
          url: url.substring(0, 120),
          status: res.status(),
          ct: ct.substring(0, 60),
          bodyPreview: body.substring(0, 500),
          bodyLength: body.length,
        })
      } catch {}
    })

    // Navigate
    let navError = ""
    try {
      await page.goto(AGENT_URL, { timeout: 40000, waitUntil: "networkidle" })
    } catch (e: any) {
      navError = e?.message?.split("\n")[0] || ""
      try { await page.goto(AGENT_URL, { timeout: 30000, waitUntil: "load" }) } catch {}
    }

    // Initial state
    const initialHomeBuilders = await page.evaluate(() => {
      const el = document.getElementById("home-builders")
      return { exists: !!el, innerHTML: el?.innerHTML?.substring(0, 1000) || "", length: el?.innerHTML?.length || 0 }
    }).catch(() => ({ exists: false, innerHTML: "", length: 0 }))

    // Scroll #home-builders into view
    await page.evaluate(() => {
      const hb = document.getElementById("home-builders")
      if (hb) hb.scrollIntoView({ behavior: "instant", block: "center" })
      else window.scrollTo(0, 500)
      window.dispatchEvent(new Event("scroll"))
    }).catch(() => {})

    // Wait up to 15s for #home-builders to populate
    const populated = await page.waitForFunction(
      () => {
        const el = document.getElementById("home-builders")
        return el && el.innerHTML.trim().length > 300
      },
      { timeout: 15000 }
    ).then(() => true).catch(() => false)

    await page.waitForTimeout(2000)

    // Post-scroll state
    const afterScrollHomeBuilders = await page.evaluate(() => {
      const el = document.getElementById("home-builders")
      return {
        exists: !!el,
        innerHTML: el?.innerHTML?.substring(0, 3000) || "",
        length: el?.innerHTML?.length || 0,
      }
    }).catch(() => ({ exists: false, innerHTML: "", length: 0 }))

    // getBSXN URL search
    const bsxnInfo = await page.evaluate(() => {
      const w = window as any
      const ajaxUrls = w.__ajaxUrls || []
      let fromWindow = null
      try {
        for (const key of Object.keys(w)) {
          try {
            const obj = w[key]
            if (obj && typeof obj === "object" && typeof obj.getBSXN === "string") {
              fromWindow = `window.${key}.getBSXN = ${obj.getBSXN}`
              break
            }
          } catch {}
        }
        if (!fromWindow && w.getBSXN) fromWindow = `window.getBSXN = ${w.getBSXN}`
      } catch {}
      const patterns = [
        /"getBSXN"\s*:\s*"([^"]+)"/,
        /'getBSXN'\s*:\s*'([^']+)'/,
        /getBSXN\s*:\s*["']([^"']+)["']/,
        /getBSXN\s*=\s*["']([^"']+)["']/,
      ]
      let fromScript = null
      for (const s of Array.from(document.querySelectorAll("script"))) {
        const text = (s as HTMLScriptElement).textContent || ""
        for (const p of patterns) {
          const m = text.match(p)
          if (m?.[1]) { fromScript = m[1]; break }
        }
        if (fromScript) break
      }
      return { fromWindow, fromScript, xhrUrls: ajaxUrls.slice(0, 20) }
    }).catch(() => ({ fromWindow: null, fromScript: null, xhrUrls: [] }))

    // Visible text
    const visibleText = await page.evaluate(() =>
      (document.body?.innerText || "").substring(0, 2000)
    ).catch(() => "")

    // "See All" link
    const seeAllInfo = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a, button"))
      const el = links.find(e => {
        const t = (e.textContent || "").toLowerCase()
        return t.includes("see all") || t.includes("view all") || t.includes("all communities")
      })
      if (!el) return null
      return {
        tag: el.tagName,
        text: el.textContent?.trim(),
        href: (el as HTMLAnchorElement).href || null,
        classes: el.className,
      }
    }).catch(() => null)

    return NextResponse.json({
      chromiumPath: executablePath,
      navError: navError || null,
      title: await page.title().catch(() => ""),
      finalUrl: page.url(),
      populated,
      initialHomeBuilders,
      afterScrollHomeBuilders,
      bsxnInfo,
      seeAllInfo,
      visibleText,
      requestCount: capturedRequests.length,
      requests: capturedRequests.slice(0, 40),
      responseCount: capturedResponses.length,
      // Show ALL showingnew.com responses first, then others
      responses: [
        ...capturedResponses.filter(r => r.url.includes("showingnew.com")),
        ...capturedResponses.filter(r => !r.url.includes("showingnew.com")).slice(0, 5),
      ].slice(0, 20),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}
