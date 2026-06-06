export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      firstName: string
      lastName: string
      email: string
      phone?: string
      message?: string
      interest?: string
    }

    const { firstName, lastName, email, phone, message, interest } = body

    if (!firstName || !lastName || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Find or create contact
    const cleanEmail = email.toLowerCase().trim()
    let contact = await prisma.contact.findFirst({
      where: { email: cleanEmail },
    })

    if (contact) {
      contact = await prisma.contact.update({
        where: { id: contact.id },
        data: {
          firstName,
          lastName,
          phone: phone || undefined,
          source: "WEBSITE",
          lastContacted: new Date(),
        },
      })
    } else {
      contact = await prisma.contact.create({
        data: {
          firstName,
          lastName,
          email: cleanEmail,
          phone: phone || null,
          source: "WEBSITE",
          status: "LEAD",
          lastContacted: new Date(),
        },
      })
    }

    // Create activity
    await prisma.activity.create({
      data: {
        type: "WEBSITE_INQUIRY",
        title: `Website inquiry from ${firstName} ${lastName}`,
        description: message || `Interested in: ${interest || "General inquiry"}`,
        contactId: contact.id,
        metadata: JSON.stringify({ interest, message }),
      },
    })

    // Create AI notification
    await prisma.aINotification.create({
      data: {
        title: "New Website Lead",
        body: `${firstName} ${lastName} (${email}) submitted an inquiry via the website. Interest: ${interest || "General"}`,
        type: "WEBSITE_LEAD",
        priority: "HIGH",
        contactId: contact.id,
        metadata: JSON.stringify({ interest, message, phone }),
      },
    })

    return NextResponse.json({ success: true, contactId: contact.id })
  } catch (error) {
    console.error("Contact form error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
