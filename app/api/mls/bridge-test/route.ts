export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { searchIdxListings } from "@/lib/bridge"

// The RESO OData Media resource returns null MediaURL for many MIAMI listings.
// Probe the Bridge WEB API (non-OData) endpoints, which may serve real photo URLs.
// Usage: /api/mls/bridge-test?city=Doral
export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const token = process.env.BRIDGE_SERVER_TOKEN
  if (!token) return NextResponse.json({ ok: false, error: "BRIDGE_SERVER_TOKEN no configurado" }, { status: 400 })

  const dataset = process.env.BRIDGE_DATASET_ID || "miamire"
  const { searchParams } = new URL(req.url)
  const city = searchParams.get("city") || undefined

  async function probe(path: string) {
    const url = `https://api.bridgedataoutput.com/api/v2/${dataset}/${path}${path.includes("?") ? "&" : "?"}access_token=${token}`
    try {
      const r = await fetch(url)
      const t = await r.text()
      const jpg = t.match(/https?:\/\/[^"'\\ ]+\.(?:jpg|jpeg|png|webp)[^"'\\ ]*/i)
      return { status: r.status, len: t.length, firstJpg: jpg ? jpg[0] : null, preview: jpg ? null : t.slice(0, 300) }
    } catch (e: any) {
      return { error: e.message }
    }
  }

  try {
    const listings = await searchIdxListings({ city, limit: 1 })
    const first: any = listings[0]
    const key = first?.ListingKey
    const listingId = first?.ListingId

    return NextResponse.json({
      ok: true,
      city: city || "(sin filtro)",
      listingKey: key,
      listingId,
      photosCount: first?.PhotosCount ?? null,
      webApi_listingsById: await probe(`listings/${key}`),
      webApi_listingsQuery: await probe(`listings?ListingId=${listingId}`),
      webApi_propertyById: await probe(`Property/${key}`),
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || "diagnostic failed" }, { status: 500 })
  }
}
