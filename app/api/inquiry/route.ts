export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { ingestLead } from "@/lib/lead-ingest"
import { sendEmail } from "@/lib/email"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { firstName, lastName, phone, email, message, mlsId, city, price, propertyType, beds, year } = body

    if (!firstName || (!phone && !email)) {
      return NextResponse.json({ ok: false, error: "Name and phone or email required" }, { status: 400 })
    }

    const { contactId, isNew } = await ingestLead({
      firstName: firstName.trim(),
      lastName: lastName?.trim() || "",
      email: email?.trim() || undefined,
      phone: phone?.trim() || undefined,
      source: "WEBSITE_NEW_CONSTRUCTION",
      message: message?.trim() || undefined,
    })

    // Activity note with property context
    const propLabel = [
      propertyType || "New Construction",
      city ? `in ${city}` : "",
      price ? `— $${Number(price).toLocaleString()}` : "",
      beds ? `· ${beds}bd` : "",
      year ? `· Built ${year}` : "",
      mlsId ? `· MLS# ${mlsId}` : "",
    ].filter(Boolean).join(" ")

    await prisma.activity.create({
      data: {
        contactId,
        type: "NOTE",
        note: `Website inquiry: ${propLabel}${message ? ` | "${message}"` : ""}`,
      },
    })

    // Notify agent (fire-and-forget)
    const config = await prisma.aIConfig.findFirst({
      select: { realtorEmail: true, realtorName: true },
    }).catch(() => null)

    const agentEmail = config?.realtorEmail || process.env.RESEND_FROM
    if (agentEmail) {
      sendEmail({
        to: agentEmail,
        subject: `New Pre-Construction Inquiry — ${city || "Miami"}`,
        html: `
          <h2 style="margin:0 0 12px">New inquiry from your website</h2>
          <table style="border-collapse:collapse;font-size:14px">
            <tr><td style="padding:4px 12px 4px 0;color:#666">Name</td><td><strong>${firstName} ${lastName || ""}</strong></td></tr>
            ${email ? `<tr><td style="padding:4px 12px 4px 0;color:#666">Email</td><td>${email}</td></tr>` : ""}
            ${phone ? `<tr><td style="padding:4px 12px 4px 0;color:#666">Phone</td><td>${phone}</td></tr>` : ""}
            <tr><td style="padding:4px 12px 4px 0;color:#666">Property</td><td>${propLabel}</td></tr>
            ${message ? `<tr><td style="padding:4px 12px 4px 0;color:#666">Message</td><td>${message}</td></tr>` : ""}
            <tr><td style="padding:4px 12px 4px 0;color:#666">Status</td><td>${isNew ? "✨ New contact created" : "Existing contact updated"}</td></tr>
          </table>
          <p style="margin-top:16px"><a href="${process.env.NEXT_PUBLIC_APP_URL}/contacts/${contactId}" style="background:#c9a84c;color:#fff;padding:8px 18px;border-radius:6px;text-decoration:none;font-size:13px">View in CRM →</a></p>
        `,
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true, isNew })
  } catch (e: any) {
    console.error("[inquiry]", e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
