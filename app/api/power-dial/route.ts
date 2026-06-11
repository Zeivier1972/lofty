export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { triggerOutboundCall } from "@/lib/vapi"

// POST: start a new auto-dial session
// body: { contactIds: string[], voicemailMsg?: string }
export async function POST(req: Request) {
  try {
    const { contactIds, voicemailMsg } = await req.json()
    if (!contactIds?.length) return NextResponse.json({ error: "contactIds required" }, { status: 400 })

    // Fetch contact details (name + phone)
    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds } },
      select: { id: true, firstName: true, lastName: true, phone: true },
    })

    // Build ordered queue (preserve selection order, skip contacts without phone)
    const ordered = contactIds
      .map((id: string) => contacts.find(c => c.id === id))
      .filter((c: any) => c && c.phone)
      .map((c: any) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`.trim(), phone: c.phone }))

    if (!ordered.length) {
      return NextResponse.json({ error: "No contacts with phone numbers in selection" }, { status: 400 })
    }

    const session = await prisma.powerDialSession.create({
      data: {
        status: "ACTIVE",
        contactQueue: JSON.stringify(ordered),
        totalCount: ordered.length,
        currentIndex: 0,
        voicemailMsg: voicemailMsg || null,
      },
    })

    // Trigger first call
    const first = ordered[0]
    const callId = await triggerOutboundCall({
      toPhone: first.phone,
      contactId: first.id,
      contactName: first.name,
      skipBusinessHoursCheck: true,
      sessionId: session.id,
      sessionIndex: 0,
      voicemailMsg: voicemailMsg || undefined,
    })

    await prisma.powerDialSession.update({
      where: { id: session.id },
      data: { currentCallId: callId || null },
    })

    return NextResponse.json({ sessionId: session.id, totalCount: ordered.length, skipped: contactIds.length - ordered.length })
  } catch (e) {
    console.error("[PowerDial] Start error:", e)
    return NextResponse.json({ error: "Failed to start session" }, { status: 500 })
  }
}
