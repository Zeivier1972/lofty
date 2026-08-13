export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { fetchListingByKey, bridgeToProperty } from "@/lib/bridge"

// Email click tracker. Property links in emails point here; we log which lead
// clicked what (a high-intent signal) AND record a property view so it feeds the
// dashboard's hot-properties / hot-buyers panels — then redirect to the page.
// Only redirects to our own site (no open-redirect abuse).

// Turn an email click on /homes/{listingKey} into a PropertyView for this lead,
// so the click counts as real property activity. Fire-and-forget.
async function recordPropertyView(contactId: string, dest: string) {
  try {
    const m = dest.match(/\/homes\/([^/?#]+)/i)
    const listingKey = m ? decodeURIComponent(m[1]) : ""
    if (!listingKey) return

    let property = await prisma.property.findFirst({ where: { mlsId: listingKey }, select: { id: true } })
    if (!property) {
      // Not in the local cache yet — pull it from the MLS so the view has a home.
      const listing = await fetchListingByKey(listingKey).catch(() => null)
      if (listing) {
        const data = bridgeToProperty(listing)
        if (data.mlsId) {
          property = await prisma.property.create({ data, select: { id: true } }).catch(() => null)
        }
      }
    }
    if (property) {
      await prisma.propertyView.create({ data: { contactId, propertyId: property.id } }).catch(() => {})
    }
  } catch { /* best-effort */ }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const contactId = searchParams.get("c") || ""
  const target = searchParams.get("u") || ""
  const label = searchParams.get("a") || ""
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://catherinegomezrealtor.com"

  // Resolve a safe destination: must be on our own domain.
  let dest = `${appUrl}/homes`
  try {
    const t = new URL(target, appUrl)
    const base = new URL(appUrl)
    if (t.hostname === base.hostname) dest = t.toString()
  } catch { /* keep default */ }

  if (contactId) {
    prisma.activity.create({
      data: {
        type: "EMAIL_CLICK",
        title: `🖱️ Hizo clic en el email${label ? `: ${label}` : ""}`,
        description: label || dest,
        contactId,
      },
    }).catch(() => {})
    // Fire-and-forget so the redirect stays instant.
    void recordPropertyView(contactId, dest)
    // Tell the on-page Sofía chat who this is, so she greets them by name.
    try {
      const d = new URL(dest)
      d.searchParams.set("sofia", contactId)
      dest = d.toString()
    } catch { /* keep dest */ }
  }

  return NextResponse.redirect(dest, 302)
}
