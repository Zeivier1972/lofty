export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import twilio from "twilio"

const PARALLEL_LIMIT = 3

function getTwilio() {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return null
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { contactIds, sessionId: existingSessionId } = await req.json()
  if (!contactIds?.length) return NextResponse.json({ error: "contactIds required" }, { status: 400 })

  const agentId = session.user.id
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const agentIdentity = `agent-${agentId}`

  // Fetch contacts (up to 3, must have phone, must not be doNotCall)
  const contacts = await prisma.contact.findMany({
    where: { id: { in: contactIds.slice(0, PARALLEL_LIMIT) }, doNotCall: false },
    select: { id: true, firstName: true, lastName: true, phone: true, phone2: true, email: true, status: true, source: true },
  })

  const dialable = contactIds
    .slice(0, PARALLEL_LIMIT)
    .map((id: string) => contacts.find(c => c.id === id))
    .filter((c: any) => c?.phone)

  if (!dialable.length) return NextResponse.json({ error: "No dialable contacts (need phone, not doNotCall)" }, { status: 400 })

  // Create or reuse session
  let dialerSession: any
  if (existingSessionId) {
    dialerSession = await prisma.dialerSession.findUnique({ where: { id: existingSessionId } })
  }
  if (!dialerSession) {
    dialerSession = await prisma.dialerSession.create({
      data: {
        name: `Parallel ${new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`,
        agentId,
        status: "ACTIVE",
        agentIdentity,
      } as any,
    })
  }

  const client = getTwilio()
  const calls: any[] = []

  for (const contact of dialable) {
    const dialerCall = await prisma.dialerCall.create({
      data: {
        contactId: contact.id,
        phoneNumber: contact.phone!,
        sessionId: dialerSession.id,
        agentId,
        status: "QUEUED",
        direction: "OUTBOUND",
      },
    })

    let twilioSid: string | null = null

    if (client) {
      try {
        const call = await client.calls.create({
          to: contact.phone!,
          from: process.env.TWILIO_PHONE_NUMBER!,
          url: `${appUrl}/api/dialer/parallel-twiml`,
          statusCallback: `${appUrl}/api/dialer/parallel-status?callDbId=${dialerCall.id}&sessionId=${dialerSession.id}&agentId=${agentId}`,
          statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
          statusCallbackMethod: "POST",
          machineDetection: "DetectMessageEnd",
          asyncAmd: "true",
        } as any)
        twilioSid = call.sid
      } catch (err) {
        console.error("[Parallel Dial] Twilio error for", contact.phone, err)
      }
    } else {
      twilioSid = `mock-${dialerCall.id}`
      console.log(`[Parallel Dial MOCK] Calling ${contact.phone} (${contact.firstName} ${contact.lastName})`)
    }

    await prisma.dialerCall.update({
      where: { id: dialerCall.id },
      data: { twilioSid, status: "RINGING", startedAt: new Date() },
    })

    calls.push({
      id: dialerCall.id,
      contactId: contact.id,
      contactName: `${contact.firstName} ${contact.lastName}`,
      phoneNumber: contact.phone,
      twilioSid,
      status: "RINGING",
    })
  }

  return NextResponse.json({ sessionId: dialerSession.id, calls })
}
