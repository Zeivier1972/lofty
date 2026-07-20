export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendSMS, toE164 } from "@/lib/sms"
import { sendEmail, wrapEmail } from "@/lib/email"
import { auth } from "@/lib/auth"
import { partnerOwnsContact } from "@/lib/partner-auth"

function priceLabel(price: number | null) {
  if (!price) return ""
  if (price >= 1_000_000) return "$" + (price / 1_000_000).toFixed(price % 1_000_000 === 0 ? 0 : 1) + "M"
  return "$" + price.toLocaleString()
}

interface ListingPayload {
  listingKey: string
  listingId: string
  address: string
  city: string | null
  state: string | null
  price: number | null
  beds: number | null
  baths: number | null
  sqft: number | null
  photoUrl: string | null
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session && !(await partnerOwnsContact(params.id))) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const { listings, method, note } = await req.json() as {
      listings: ListingPayload[]
      method: "email" | "sms"
      note?: string
    }

    if (!method || !["email", "sms"].includes(method)) {
      return NextResponse.json({ ok: false, error: "method must be email or sms" }, { status: 400 })
    }
    if (!listings?.length) {
      return NextResponse.json({ ok: false, error: "No listings provided" }, { status: 400 })
    }

    const contact = await prisma.contact.findUnique({
      where: { id: params.id },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true },
    })
    if (!contact) return NextResponse.json({ ok: false, error: "Contact not found" }, { status: 404 })

    const agentConfig = await prisma.aIConfig.findFirst({
      select: { realtorName: true, realtorEmail: true, realtorPhone: true },
    }).catch(() => null)

    const agentName = agentConfig?.realtorName || session?.user?.name || "Your Agent"
    const agentPhone = agentConfig?.realtorPhone || process.env.TWILIO_PHONE_NUMBER || ""
    const agentEmail = agentConfig?.realtorEmail || process.env.REALTOR_EMAIL || ""

    if (method === "email") {
      if (!contact.email) {
        return NextResponse.json({ ok: false, error: "Contact has no email address" }, { status: 400 })
      }

      const propertyCards = listings.map((l, i) => {
        const specs = [
          l.beds ? `${l.beds} bd` : "",
          l.baths ? `${l.baths} ba` : "",
          l.sqft ? `${l.sqft.toLocaleString()} sqft` : "",
        ].filter(Boolean).join(" · ")
        const location = [l.city, l.state].filter(Boolean).join(", ")

        // Link the whole card to the listing's detail page (all photos + info)
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || ""
        const detailUrl = l.listingKey ? `${appUrl}/homes/${encodeURIComponent(l.listingKey)}` : ""
        const open = detailUrl ? `<a href="${detailUrl}" style="text-decoration:none;color:inherit;display:block" target="_blank">` : "<div>"
        const close = detailUrl ? "</a>" : "</div>"

        return `
          <div style="margin-bottom:20px;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden">
            ${open}
              ${l.photoUrl ? `<img src="${l.photoUrl}" alt="Property ${i + 1}" style="width:100%;height:180px;object-fit:cover;display:block"/>` : ""}
              <div style="padding:16px">
                ${l.price ? `<p style="font-size:20px;font-weight:bold;color:#059669;margin:0 0 4px">${priceLabel(l.price)}</p>` : ""}
                ${l.address ? `<p style="font-weight:600;color:#111827;margin:0 0 2px">${l.address}</p>` : ""}
                ${location ? `<p style="color:#6B7280;font-size:13px;margin:0 0 6px">${location}</p>` : ""}
                ${specs ? `<p style="color:#6B7280;font-size:13px;margin:0 0 4px">${specs}</p>` : ""}
                ${l.listingId ? `<p style="color:#9CA3AF;font-size:11px;margin:0 0 10px">MLS# ${l.listingId}</p>` : ""}
                ${detailUrl ? `<span style="display:inline-block;background:#0e1f3d;color:#fff;padding:9px 16px;border-radius:8px;font-size:13px;font-weight:600">Ver más fotos e info →</span>` : ""}
              </div>
            ${close}
          </div>
        `
      }).join("")

      const subjectCity = listings[0]?.city || "your area"
      const html = wrapEmail(`
        <h2 style="color:#111827;margin:0 0 6px">Hi ${contact.firstName}! 🏠</h2>
        <p style="color:#374151;margin:0 0 20px">
          I found ${listings.length} propert${listings.length === 1 ? "y" : "ies"} I think you'll love — take a look:
        </p>
        ${propertyCards}
        ${note ? `<div style="background:#FEF9C3;border-radius:8px;padding:12px 16px;margin:0 0 16px"><p style="color:#374151;font-size:14px;margin:0"><em>"${note}"</em></p></div>` : ""}
        <a href="${process.env.NEXT_PUBLIC_APP_URL || ""}/book"
           style="background:#c9a84c;color:#0a0e1a;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;margin:0 0 16px">
          Schedule a Showing →
        </a>
        <p style="color:#6B7280;font-size:14px;margin:0">📞 ${agentPhone}</p>
      `, { agentName, agentPhone, agentEmail })

      await sendEmail({
        to: contact.email,
        subject: `${listings.length} Property Match${listings.length > 1 ? "es" : ""} in ${subjectCity}`,
        html,
      })
    }

    if (method === "sms") {
      if (!contact.phone) {
        return NextResponse.json({ ok: false, error: "Contact has no phone number" }, { status: 400 })
      }

      const lines = [
        `Hi ${contact.firstName}! 🏠 I found ${listings.length} propert${listings.length === 1 ? "y" : "ies"} for you:\n`,
        ...listings.map((l, i) => {
          const parts = [
            priceLabel(l.price),
            l.address,
            [l.city, l.state].filter(Boolean).join(", "),
            [l.beds ? `${l.beds}bd` : "", l.baths ? `${l.baths}ba` : ""].filter(Boolean).join("/"),
            l.listingId ? `MLS# ${l.listingId}` : "",
            l.listingKey ? `${process.env.NEXT_PUBLIC_APP_URL || ""}/homes/${encodeURIComponent(l.listingKey)}` : "",
          ].filter(Boolean)
          return `${i + 1}. ${parts.join(" — ")}`
        }),
        note ? `\n"${note}"` : "",
        `\nWant to see any of these? Call or text me! — ${agentName}`,
      ].filter(Boolean)

      const firstPhoto = listings.find(l => l.photoUrl)?.photoUrl || undefined
      const toPhone = toE164(contact.phone)
      await sendSMS(toPhone, lines.join("\n"), firstPhoto ? [firstPhoto] : undefined)
    }

    // Single activity log entry for the batch
    const summary = listings
      .map(l => `${l.address || l.listingId}${l.price ? ` ($${Number(l.price).toLocaleString()})` : ""}`)
      .join("; ")

    await prisma.activity.create({
      data: {
        contactId: contact.id,
        type: method === "email" ? "EMAIL_SENT" : "SMS_SENT",
        title: `${listings.length} propert${listings.length === 1 ? "y" : "ies"} shared via ${method}: ${summary}`,
      },
    })

    return NextResponse.json({ ok: true, count: listings.length })
  } catch (e: any) {
    console.error("[send-properties-batch]", e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
