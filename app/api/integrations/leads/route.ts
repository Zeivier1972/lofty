export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import crypto from "crypto"
import { ingestLead } from "@/lib/lead-ingest"

// Lead intake for partner apps — Easy Rental first.
//
// Easy Rental already reads MLS listings out of CASAi (see the CORS note on
// /api/idx/search), but nothing ever came back the other way: it has carried a
// CASAI_API_KEY in its config with no endpoint in CASAi listening for it, so
// every lead it captured stayed in its own database. This is that endpoint.
//
// Server-to-server only. There are deliberately no CORS headers: a key shipped
// to a browser is a public key, and this one creates contacts.
//
//   POST /api/integrations/leads
//   x-api-key: <PARTNER_API_KEY>
//   { "firstName": "Ana", "phone": "+13055551234", "email": "ana@x.com",
//     "message": "Interested in 123 Main St", "location": "Homestead" }

function authorized(req: Request): boolean {
  const expected = process.env.PARTNER_API_KEY
  // Fail closed. An unset key must not mean "anyone may create contacts".
  if (!expected) return false
  const given = req.headers.get("x-api-key") || ""
  // Compare digests so the lengths always match and the comparison is constant-time.
  const a = crypto.createHash("sha256").update(given).digest()
  const b = crypto.createHash("sha256").update(expected).digest()
  return crypto.timingSafeEqual(a, b)
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined)
  const num = (v: unknown) => (v == null || v === "" || isNaN(Number(v)) ? undefined : Number(v))

  const firstName = str(body.firstName) || str(body.name)?.split(" ")[0]
  const email = str(body.email)?.toLowerCase()
  const phone = str(body.phone)

  if (!firstName) return NextResponse.json({ error: "firstName is required" }, { status: 400 })
  // Without one of these the contact cannot be reached, and dedupe has nothing
  // to match on — every submission would create a fresh duplicate.
  if (!email && !phone) {
    return NextResponse.json({ error: "email or phone is required" }, { status: 400 })
  }

  // The partner names itself so a second one later is a config change, not a
  // code change; Easy Rental stays the default since it is the one asking.
  const partner = str(body.source) || "EASY_RENTAL"
  const label = partner === "EASY_RENTAL" ? "Easy Rental" : partner

  // Listing context belongs in the note, not in a field the buyer-preference
  // matcher reads — it would be treated as a stated preference and narrow the
  // lead's future alerts to one address.
  const listing = str(body.listingId) || str(body.mlsId)
  const noteParts = [
    str(body.message),
    listing ? `Listing: ${listing}` : undefined,
    str(body.notes),
  ].filter(Boolean)

  try {
    const { contactId, isNew } = await ingestLead({
      firstName,
      lastName: str(body.lastName) || str(body.name)?.split(" ").slice(1).join(" ") || undefined,
      email,
      phone,
      source: partner,
      campaign: str(body.campaign),
      budget: num(body.budget) ?? null,
      location: str(body.location),
      bedroomsMin: num(body.bedroomsMin) ?? null,
      propertyType: str(body.propertyType),
      message: noteParts.join(" · ") || undefined,
      smsConsent: body.smsConsent === true,
      // Tagged so Catherine can see where it came from, and so a smart plan can
      // be pointed at rental leads without touching any of the buyer plans.
      tags: Array.isArray(body.tags) && body.tags.length > 0
        ? body.tags.filter((t: unknown) => typeof t === "string")
        : [label, "Renta"],
    })

    console.log(`[integrations/leads] ${label} lead ${isNew ? "created" : "matched"} contact=${contactId}`)

    return NextResponse.json({
      ok: true,
      contactId,
      isNew,
      contactUrl: `${process.env.NEXT_PUBLIC_APP_URL || ""}/contacts/${contactId}`,
    })
  } catch (e: any) {
    console.error("[integrations/leads] ingest failed:", e)
    return NextResponse.json({ ok: false, error: e?.message || "Ingest failed" }, { status: 500 })
  }
}
