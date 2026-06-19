export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import twilio from "twilio"

function getTwilioClient() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return null
  return twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id
  const { contactIds, sessionId } = await req.json()

  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    return NextResponse.json({ error: "contactIds required" }, { status: 400 })
  }

  // Fetch up to 3 contacts with phones (skip doNotCall=true)
  const contacts = await prisma.contact.findMany({
    where: {
      id: { in: contactIds.slice(0, 3) },
      doNotCall: false,
      phone: { not: null },
    },
    take: 3,
  })

  const agentIdentity = `agent-${userId}`
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || ""

  // Create or use existing DialerSession
  let dialerSession
  if (sessionId) {
    dialerSession = await prisma.dialerSession.findUnique({ where: { id: sessionId } })
  }
  if (!dialerSession) {
    dialerSession = await prisma.dialerSession.create({
      data: {
        name: `Parallel Session ${new Date().toLocaleDateString()}`,
        agentId: userId,
        agentIdentity,
      },
    })
  } else if (!dialerSession.agentIdentity) {
    dialerSession = await prisma.dialerSession.update({
      where: { id: dialerSession.id },
      data: { agentIdentity },
    })
  }

  const client = getTwilioClient()
  const calls: Array<{ id: string; contactId: string; phoneNumber: string; twilioSid: string }> = []

  for (const contact of contacts) {
    const phone = contact.phone!

    // Create DialerCall record first
    const dialerCall = await prisma.dialerCall.create({
      data: {
        contactId: contact.id,
        phoneNumber: phone,
        sessionId: dialerSession.id,
        status: "QUEUED",
        direction: "OUTBOUND",
        agentId: userId,
      },
    })

    let twilioSid: string

    if (!client) {
      // Mock mode
      twilioSid = `mock-parallel-sid-${dialerCall.id}`
      console.log("[PARALLEL DIAL MOCK] To:", phone, "callId:", dialerCall.id)
    } else {
      try {
        const call = await client.calls.create({
          to: phone,
          from: process.env.TWILIO_PHONE_NUMBER!,
          url: `${APP_URL}/api/dialer/parallel-twiml?callId=${dialerCall.id}`,
          statusCallback: `${APP_URL}/api/dialer/parallel-status`,
          statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
          statusCallbackMethod: "POST",
          machineDetection: "DetectMessageEnd",
          asyncAmd: "true",
        })
        twilioSid = call.sid
      } catch (err) {
        console.error("[PARALLEL DIAL] Failed to create call:", err)
        await prisma.dialerCall.update({
          where: { id: dialerCall.id },
          data: { status: "FAILED" },
        })
        continue
      }
    }

    await prisma.dialerCall.update({
      where: { id: dialerCall.id },
      data: { twilioSid, status: "RINGING", startedAt: new Date() },
    })

    calls.push({
      id: dialerCall.id,
      contactId: contact.id,
      phoneNumber: phone,
      twilioSid,
    })
  }

  return NextResponse.json({ sessionId: dialerSession.id, calls })
}
