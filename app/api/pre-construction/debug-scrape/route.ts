export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getChromiumPath } from "@/lib/showingnew-scraper"

const AGENT_URL = "https://www.showingnew.com/catherinegomez"
const BSXN_URL = "https://www.showingnew.com/catherinegomez/home/getbuildersection"
const COMMUNITIES_URL = "https://www.showingnew.com/catherinegomez/communities/florida/miami-dade-county"

const HEADERS = {
  "Accept": "text/html, */*; q=0.1",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  "Referer": AGENT_URL,
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "X-Requested-With": "XMLHttpRequest",
}

// Debug endpoint — shows direct HTTP responses from BSXN and communities endpoints
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const chromiumPath = getChromiumPath()
  const results: Record<string, any> = { chromiumPath }

  // Fetch both endpoints directly
  for (const [name, url] of [["bsxn", BSXN_URL], ["communities", COMMUNITIES_URL]] as const) {
    try {
      const res = await fetch(url, { headers: HEADERS })
      const body = await res.text()
      results[name] = {
        url,
        status: res.status,
        contentType: res.headers.get("content-type"),
        bodyLength: body.length,
        bodyPreview: body.substring(0, 3000),
        // Count some known patterns
        priceCount: (body.match(/\$\s*[\d,]+/g) || []).length,
        cityFLCount: (body.match(/[A-Z][a-zA-Z]+,?\s*FL\b/g) || []).length,
        imgCount: (body.match(/akamaized\.net[^"'\s]*\.(?:jpg|png|webp)/gi) || []).length,
      }
    } catch (e: any) {
      results[name] = { url, error: e?.message }
    }
  }

  return NextResponse.json(results)
}
