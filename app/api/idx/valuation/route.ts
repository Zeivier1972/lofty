export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { searchIdxListings } from "@/lib/bridge"
import { isBotSubmission, clientIp, rateLimit } from "@/lib/spam-guard"

// Public: "What's my home worth" — estimates a value from active comps (aggregate
// $/sqft, not redistributing listings) and captures the seller as a CRM lead.
export async function POST(req: Request) {
  try {
    const b = await req.json()
    const { address, city, zip, beds, baths, sqft, firstName, lastName, email, phone } = b || {}

    // Spam bots fill this form with random strings. Answer like a success so
    // they don't adapt, but create no contact, notification or outreach.
    const bot = isBotSubmission({ body: b, elapsedMs: b?.elapsedMs, fields: [firstName, lastName, address, city] })
      || (rateLimit(`valuation:${clientIp(req)}`, 5, 3600 * 1000).ok ? null : "rate-limit")
    if (bot) {
      console.warn(`[valuation] bot submission dropped (${bot})`)
      return NextResponse.json({ ok: true, contactId: null, estimateLow: null, estimateHigh: null, compCount: 0 })
    }
    if (!address || (!email && !phone)) {
      return NextResponse.json({ error: "Necesitamos la dirección y tu email o teléfono." }, { status: 400 })
    }

    const num = (v: any) => (v != null && v !== "" && !isNaN(Number(v)) ? Number(v) : null)
    const homeSqft = num(sqft)
    const bedsN = num(beds)

    // Active comps in the same area
    const comps = await searchIdxListings({
      city: city || undefined,
      zip: zip || undefined,
      minBeds: bedsN ? Math.max(1, bedsN - 1) : undefined,
      limit: 50,
    })

    const ppsf = comps
      .map((l: any) => (l.ListPrice && l.LivingArea ? l.ListPrice / l.LivingArea : null))
      .filter((x: any): x is number => typeof x === "number" && isFinite(x) && x > 0)
      .sort((a, b) => a - b)
    const prices = comps
      .map((l: any) => l.ListPrice)
      .filter((x: any): x is number => typeof x === "number" && x > 0)
      .sort((a, b) => a - b)

    const median = (arr: number[]) => (arr.length ? arr[Math.floor(arr.length / 2)] : null)
    const medPpsf = median(ppsf)
    const medPrice = median(prices)

    let estimate: number | null = null
    if (medPpsf && homeSqft) estimate = medPpsf * homeSqft
    else if (medPrice) estimate = medPrice

    const low = estimate ? Math.round((estimate * 0.92) / 1000) * 1000 : null
    const high = estimate ? Math.round((estimate * 1.08) / 1000) * 1000 : null

    // Capture the seller lead
    const em = (email || "").trim() || null
    const ph = (phone || "").trim() || null
    const or: any[] = []
    if (em) or.push({ email: em })
    if (ph) or.push({ phone: ph })
    let contact = or.length ? await prisma.contact.findFirst({ where: { OR: or } }) : null
    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          firstName: (firstName || "").trim() || "Vendedor",
          lastName: (lastName || "").trim() || (ph || "Web"),
          email: em, phone: ph,
          source: "SELLER_VALUATION", status: "NEW_LEAD",
          sellerAddress: String(address).slice(0, 200),
          sellerEstimatedValue: estimate ?? undefined,
        },
      })
    } else {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { sellerAddress: String(address).slice(0, 200), sellerEstimatedValue: estimate ?? undefined },
      }).catch(() => {})
    }

    await prisma.activity.create({
      data: {
        type: "SELLER_VALUATION",
        title: "Solicitó valuación de su propiedad",
        description: `${address}${estimate ? ` — estimado ~$${Math.round(estimate).toLocaleString()}` : ""}`,
        contactId: contact.id,
      },
    }).catch(() => {})
    await prisma.aINotification.create({
      data: {
        type: "SELLER_LEAD",
        title: `🏷️ ${contact.firstName} quiere vender`,
        body: `${address}${estimate ? ` — estimado ~$${Math.round(estimate).toLocaleString()}` : ""}. Lead de vendedor — llama pronto para el CMA.`,
        priority: "HIGH",
        contactId: contact.id,
      },
    }).catch(() => {})

    return NextResponse.json({
      ok: true,
      contactId: contact.id,
      estimateLow: low,
      estimateHigh: high,
      compCount: comps.length,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "No se pudo calcular" }, { status: 500 })
  }
}
