export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendSMS, toE164 } from "@/lib/sms"
import { sendEmail, wrapEmail } from "@/lib/email"
import { auth } from "@/lib/auth"

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const {
      address, city, state, price, beds, baths, sqft,
      photoUrl, listingId, listingKey, method, note,
    } = await req.json()

    if (!method || !["email", "sms"].includes(method)) {
      return NextResponse.json({ ok: false, error: "method must be email or sms" }, { status: 400 })
    }

    const contact = await prisma.contact.findUnique({
      where: { id: params.id },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true },
    })
    if (!contact) return NextResponse.json({ ok: false, error: "Contact not found" }, { status: 404 })

    const agentConfig = await prisma.aIConfig.findFirst({
      select: { realtorName: true, realtorEmail: true, realtorPhone: true },
    }).catch(() => null)

    const agentName = agentConfig?.realtorName || session.user?.name || "Your Agent"
    const agentPhone = agentConfig?.realtorPhone || process.env.TWILIO_PHONE_NUMBER || ""
    const agentEmail = agentConfig?.realtorEmail || process.env.REALTOR_EMAIL || ""

    const priceLabel = price ? `$${Number(price).toLocaleString()}` : ""
    const locationLabel = [city, state].filter(Boolean).join(", ")
    const propSummary = [address, locationLabel].filter(Boolean).join(" · ")
    const specLabel = [
      beds ? `${beds} bd` : "",
      baths ? `${baths} ba` : "",
      sqft ? `${Number(sqft).toLocaleString()} sqft` : "",
    ].filter(Boolean).join(" · ")
    const mlsRef = listingId || listingKey
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ""
    const detailUrl = listingKey ? `${appUrl}/homes/${encodeURIComponent(listingKey)}` : ""

    if (method === "email") {
      if (!contact.email) {
        return NextResponse.json({ ok: false, error: "Contact has no email address" }, { status: 400 })
      }

      const html = wrapEmail(`
        <h2 style="color:#111827;margin:0 0 8px">Hi ${contact.firstName}! 🏠</h2>
        <p style="color:#374151;margin:0 0 16px">I found a property I think you'll love — take a look:</p>

        ${photoUrl ? (detailUrl
          ? `<a href="${detailUrl}" target="_blank"><img src="${photoUrl}" alt="Property" style="width:100%;max-height:280px;object-fit:cover;border-radius:12px;margin:0 0 16px;display:block"/></a>`
          : `<img src="${photoUrl}" alt="Property" style="width:100%;max-height:280px;object-fit:cover;border-radius:12px;margin:0 0 16px;display:block"/>`) : ""}

        <div style="background:#F9FAFB;border-radius:12px;padding:20px;margin:0 0 16px;border:1px solid #E5E7EB">
          ${priceLabel ? `<p style="font-size:26px;font-weight:bold;color:#059669;margin:0 0 6px">${priceLabel}</p>` : ""}
          ${address ? `<p style="font-weight:600;color:#111827;font-size:16px;margin:0 0 2px">${address}</p>` : ""}
          ${locationLabel ? `<p style="color:#6B7280;font-size:14px;margin:0 0 10px">${locationLabel}</p>` : ""}
          ${specLabel ? `<p style="color:#6B7280;font-size:14px;margin:0">${specLabel}</p>` : ""}
          ${mlsRef ? `<p style="color:#9CA3AF;font-size:12px;margin:8px 0 0">MLS# ${mlsRef}</p>` : ""}
          ${detailUrl ? `<div style="margin:14px 0 0"><a href="${detailUrl}" target="_blank" style="display:inline-block;background:#0e1f3d;color:#fff;padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Ver más fotos e info →</a></div>` : ""}
        </div>

        ${note ? `<div style="background:#FEF9C3;border-radius:8px;padding:12px 16px;margin:0 0 16px"><p style="color:#374151;font-size:14px;margin:0"><em>"${note}"</em></p></div>` : ""}

        <a href="${appUrl}/book"
           style="background:#c9a84c;color:#0a0e1a;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;margin:0 0 16px">
          Schedule a Showing →
        </a>
        <p style="color:#6B7280;font-size:14px;margin:0">📞 ${agentPhone}</p>
      `, { agentName, agentPhone, agentEmail })

      await sendEmail({
        to: contact.email,
        subject: `Property Match${priceLabel ? ` — ${priceLabel}` : ""}${city ? ` in ${city}` : ""}`,
        html,
      })
    }

    if (method === "sms") {
      if (!contact.phone) {
        return NextResponse.json({ ok: false, error: "Contact has no phone number" }, { status: 400 })
      }

      const lines = [
        `Hi ${contact.firstName}! 🏠 I found a property for you:`,
        [priceLabel, propSummary].filter(Boolean).join(" — "),
        specLabel,
        mlsRef ? `MLS# ${mlsRef}` : "",
        detailUrl ? `Ver más: ${detailUrl}` : "",
        note ? `"${note}"` : "",
        `\nInterested? Call or text me! — ${agentName}`,
      ].filter(Boolean)

      const toPhone = toE164(contact.phone)
      await sendSMS(toPhone, lines.join("\n"), photoUrl ? [photoUrl] : undefined)
    }

    // Log to contact activity timeline
    await prisma.activity.create({
      data: {
        contactId: contact.id,
        type: method === "email" ? "EMAIL_SENT" : "SMS_SENT",
        title: `Property shared via ${method === "email" ? "email" : "SMS"}: ${propSummary}${priceLabel ? ` — ${priceLabel}` : ""}${mlsRef ? ` (MLS# ${mlsRef})` : ""}`,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error("[send-property]", e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
