export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { scoreContact } from "@/lib/scoring"

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
          : { buyerBudgetMax: budgetNum, buyerLocation: area }),
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

    // Trigger AI score
    scoreContact(contact.id).catch(() => {})

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
