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
        title: `Website inquiry: ${propLabel}${message ? ` | "${message}"` : ""}`,
      },
    })

    // Notify agent (fire-and-forget)
    const config = await prisma.aIConfig.findFirst({
      select: { realtorEmail: true, realtorName: true },
    }).catch(() => null)

    const agentEmail = config?.realtorEmail || process.env.RESEND_FROM
    if (agentEmail) {
      const mlsBox = mlsId
        ? `<div style="margin:0 0 16px;padding:12px 16px;background:#fdf8ee;border:2px solid #c9a84c;border-radius:8px;font-size:15px">
            <span style="color:#666;font-size:12px;text-transform:uppercase;letter-spacing:1px">MLS # to look up</span><br/>
            <strong style="font-size:22px;color:#0a0e1a;letter-spacing:1px">${mlsId}</strong>
           </div>`
        : `<div style="margin:0 0 16px;padding:12px 16px;background:#f9fafb;border-radius:8px;font-size:13px;color:#666">General inquiry — no specific listing selected</div>`

      sendEmail({
        to: agentEmail,
        subject: `New Pre-Construction Inquiry${mlsId ? ` — MLS# ${mlsId}` : ""} — ${city || "Miami"}`,
        html: `
          <h2 style="margin:0 0 16px;font-size:18px">New inquiry from your website</h2>
          ${mlsBox}
          <table style="border-collapse:collapse;font-size:14px;width:100%">
            <tr><td style="padding:6px 16px 6px 0;color:#666;white-space:nowrap">Name</td><td><strong>${firstName} ${lastName || ""}</strong></td></tr>
            ${email ? `<tr><td style="padding:6px 16px 6px 0;color:#666">Email</td><td><a href="mailto:${email}" style="color:#1a2744">${email}</a></td></tr>` : ""}
            ${phone ? `<tr><td style="padding:6px 16px 6px 0;color:#666">Phone</td><td><a href="tel:${phone}" style="color:#1a2744">${phone}</a></td></tr>` : ""}
            <tr><td style="padding:6px 16px 6px 0;color:#666;white-space:nowrap">Property</td><td>${propLabel}</td></tr>
            ${message ? `<tr><td style="padding:6px 16px 6px 0;color:#666;vertical-align:top">Message</td><td><em>"${message}"</em></td></tr>` : ""}
            <tr><td style="padding:6px 16px 6px 0;color:#666">Status</td><td>${isNew ? "✨ New contact created in CRM" : "↩ Existing contact updated"}</td></tr>
          </table>
          <p style="margin-top:20px">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/contacts/${contactId}" style="background:#c9a84c;color:#0a0e1a;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">View Contact in CRM →</a>
          </p>
        `,
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true, isNew })
  } catch (e: any) {
    console.error("[inquiry]", e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
