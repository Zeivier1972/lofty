export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

// Image proxy for emails. MLS/CDN photo hosts often block Gmail's image proxy
// (hotlink protection), so photos hot-linked straight into an email break —
// which also tanks the spam score. Serving them through our own verified
// domain (this endpoint) makes them load reliably and look legitimate.
//
// Safety: https only, block internal/private hosts, only return image/* bodies,
// cap size, short timeout. On any problem, fall back to a neutral house photo
// so an email never shows a broken-image icon.

const FALLBACK = "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80&auto=format&fit=crop"

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase()
  return (
    h === "localhost" ||
    h.endsWith(".local") || h.endsWith(".internal") ||
    /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    h === "0.0.0.0" || h === "::1"
  )
}

export async function GET(req: Request) {
  const u = new URL(req.url).searchParams.get("u") || ""
  let target: URL
  try { target = new URL(u) } catch { return NextResponse.redirect(FALLBACK, 302) }
  if (target.protocol !== "https:" || isPrivateHost(target.hostname)) {
    return NextResponse.redirect(FALLBACK, 302)
  }
  try {
    const res = await fetch(target.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CatherineGomezRealtor/1.0; +https://catherinegomezrealtor.com)" },
      signal: AbortSignal.timeout(8000),
    })
    const ct = res.headers.get("content-type") || ""
    if (!res.ok || !ct.startsWith("image/")) return NextResponse.redirect(FALLBACK, 302)
    const buf = await res.arrayBuffer()
    if (buf.byteLength > 10_000_000) return NextResponse.redirect(FALLBACK, 302)
    return new NextResponse(Buffer.from(buf), {
      headers: {
        "Content-Type": ct,
        "Cache-Control": "public, max-age=604800, immutable",
      },
    })
  } catch {
    return NextResponse.redirect(FALLBACK, 302)
  }
}
