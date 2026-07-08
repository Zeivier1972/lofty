export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { scoreContact } from "@/lib/scoring"
import { triggerOutboundCall } from "@/lib/vapi"
import { sendCapiEvent } from "@/lib/facebook"
import { triggerMatchAlert } from "@/lib/trigger-match-alert"

// Public endpoint — no auth required
export async function POST(req: Request) {
  try {
    const { firstName, lastName, email, phone, message, source, smsConsent, budget, area, type } = await req.json()

    if (!firstName || (!email && !phone)) {
      return NextResponse.json({ error: "Name and contact info required" }, { status: 400 })
    }

    // Check for existing contact
    const existing = email
      ? await prisma.contact.findFirst({ where: { email } })
      : phone
        ? await prisma.contact.findFirst({ where: { phone: { contains: phone.replace(/\D/g, "").slice(-10) } } })
        : null

    if (existing) {
      // Update existing contact with new info
      await prisma.contact.update({
        where: { id: existing.id },
        data: {
          smsTCPAConsent: smsConsent || existing.smsTCPAConsent,
          smsTCPAConsentDate: smsConsent ? new Date() : existing.smsTCPAConsentDate,
          smsTCPAConsentMethod: smsConsent ? "web_form" : existing.smsTCPAConsentMethod,
        },
      })

      if (message) {
        await prisma.note.create({
          data: { content: `[Lead Form] ${message}`, contactId: existing.id },
        })
      }

      return NextResponse.json({ success: true, contactId: existing.id, existing: true })
    }

    const isSeller = type === "seller"
    const budgetNum = budget ? parseInt(String(budget).replace(/\D/g, "")) || null : null

    const contact = await prisma.contact.create({
      data: {
        firstName,
        lastName: lastName || "",
        email: email || undefined,
        phone: phone || undefined,
        source: source || "WEBSITE",
        status: "LEAD",
        smsTCPAConsent: !!smsConsent,
        smsTCPAConsentDate: smsConsent ? new Date() : undefined,
        smsTCPAConsentMethod: smsConsent ? "web_form" : undefined,
        ...(isSeller
          ? { sellerAddress: area, sellerEstimatedValue: budgetNum }
          // matchPrefsCompletedAt lets the hourly Sofia cron pick this lead up.
          // No area/budget on the form → default search: Miami + Homestead, $400k–$650k.
          : {
              buyerBudgetMin: budgetNum ? undefined : 400000,
              buyerBudgetMax: budgetNum || 650000,
              buyerLocation: area || "Miami, Homestead",
              matchPrefsCompletedAt: new Date(),
            }),
      },
    })

    if (message) {
      await prisma.note.create({
        data: { content: `[Lead Form] ${message}`, contactId: contact.id },
      })
    }

    await prisma.aINotification.create({
      data: {
        type: "NEW_LEAD",
        title: `Nuevo lead: ${firstName} ${lastName || ""}`,
        body: `Fuente: ${source || "web form"}${phone ? ` · ${phone}` : ""}`,
        priority: "HIGH",
        contactId: contact.id,
      },
    })

    // Report Lead event to Facebook CAPI with browser signals for better match quality
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || null
    const clientUserAgent = req.headers.get("user-agent") || null
    const fbp = req.headers.get("cookie")?.match(/_fbp=([^;]+)/)?.[1] || null
    const fbc = req.headers.get("cookie")?.match(/_fbc=([^;]+)/)?.[1] || null
    sendCapiEvent("Lead", { email, phone, firstName, lastName, clientIp, clientUserAgent, fbp, fbc }, { eventId: contact.id }).catch(() => {})

    // Trigger AI score
    scoreContact(contact.id).catch(() => {})

    // Immediately send matching MLS properties (buyers with an area/budget + email).
    // Uses the lead's location (e.g. 33032) against live MLS.
    if (!isSeller && email && (area || budgetNum)) {
      triggerMatchAlert(contact.id).catch(() => {})
    }

    // Trigger AI outbound call if phone provided (30s delay so DB commits first)
    if (phone) {
      const toPhone = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "").slice(-10)}`
      setTimeout(() => {
        triggerOutboundCall({
          toPhone,
          contactId: contact.id,
          contactName: `${firstName} ${lastName || ""}`.trim(),
          budgetMax: budgetNum,
          location: isSeller ? undefined : (area || undefined),
        }).catch(() => {})
      }, 30_000)
    }

    // Trigger AI follow-up
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ai/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trigger: "NEW_LEAD", contactId: contact.id }),
    }).catch(() => {})

    return NextResponse.json({ success: true, contactId: contact.id })
  } catch (e) {
    console.error("Lead capture error:", e)
    return NextResponse.json({ error: "Failed to save lead" }, { status: 500 })
  }
}
