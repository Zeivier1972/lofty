export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { searchIdxListings } from "@/lib/bridge"

// Probe several ways to fetch photos for one listing, to find which one returns
// media when ResourceRecordKey eq ListingKey returns 0.
// Usage: /api/mls/bridge-test?city=Doral
export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const token = process.env.BRIDGE_SERVER_TOKEN
  if (!token) return NextResponse.json({ ok: false, error: "BRIDGE_SERVER_TOKEN no configurado" }, { status: 400 })

  const dataset = process.env.BRIDGE_DATASET_ID || "miamire"
  const base = `https://api.bridgedataoutput.com/api/v2/OData/${dataset}`
  const { searchParams } = new URL(req.url)
  const city = searchParams.get("city") || undefined

  async function mediaBy(field: string, val: string) {
    const q = new URLSearchParams({ access_token: token! })
    q.set("$filter", `${field} eq '${val}'`)
    q.set("$top", "2")
    try {
      const r = await fetch(`${base}/Media?${q.toString()}`)
      const j: any = await r.json().catch(() => ({}))
      const rows = j.value || []
      return { count: j["@odata.count"] ?? rows.length, firstUrl: rows[0]?.MediaURL || rows[0]?.ResizeMediaURL || null }
    } catch (e: any) {
      return { error: e.message }
    }
  }

  try {
    const listings = await searchIdxListings({ city, limit: 1 })
    const first: any = listings[0]
    const key = first?.ListingKey
    const listingId = first?.ListingId
    const keyNumeric = first?.ListingKeyNumeric

    // Probe 3: Property $expand=Media
    let expand: any = null
    try {
      const eq = new URLSearchParams({ access_token: token })
      eq.set("$filter", `ListingKey eq '${key}'`)
      eq.set("$expand", "Media")
      eq.set("$top", "1")
      const er = await fetch(`${base}/Property?${eq.toString()}`)
      const ej: any = await er.json().catch(() => ({}))
      const em = ej.value?.[0]?.Media || []
      expand = { count: em.length, firstUrl: em[0]?.MediaURL || null }
    } catch (e: any) {
      expand = { error: e.message }
    }

    return NextResponse.json({
      ok: true,
      city: city || "(sin filtro)",
      listingKey: key,
      listingId,
      keyNumeric,
      photosCount: first?.PhotosCount ?? null,
      byResourceRecordKey_ListingKey: await mediaBy("ResourceRecordKey", key),
      byResourceRecordKey_ListingId: await mediaBy("ResourceRecordKey", listingId),
      byListingId: await mediaBy("ListingId", listingId),
      expandMedia: expand,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || "diagnostic failed" }, { status: 500 })
  }
}
