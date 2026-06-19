export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendSSE } from "@/lib/dialer-sse"
import twilio from "twilio"

function getTwilioClient() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return null
  return twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const CallSid = formData.get("CallSid") as string
    const CallStatus = formData.get("CallStatus") as string
    const CallDuration = formData.get("CallDuration") as string | null

    if (!CallSid || !CallStatus) {
      return NextResponse.json({ error: "Missing CallSid or CallStatus" }, { status: 400 })
    }

    // Look up DialerCall by twilioSid
    const dialerCall = await prisma.dialerCall.findFirst({
      where: { twilioSid: CallSid },
    })

    if (!dialerCall) {
      console.warn("[PARALLEL STATUS] No DialerCall found for SID:", CallSid)
      return NextResponse.json({ ok: true })
    }

    const sessionId = dialerCall.sessionId
    if (!sessionId) {
      return NextResponse.json({ ok: true })
    }

    const dialerSession = await prisma.dialerSession.findUnique({
      where: { id: sessionId },
    })
    if (!dialerSession) {
      return NextResponse.json({ ok: true })
    }

    const client = getTwilioClient()
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || ""

    // Handle answered call
    if (CallStatus === "in-progress") {
      // Atomic first-answer claim
      const updateResult = await prisma.dialerSession.updateMany({
        where: { id: sessionId, activeCallSid: null },
        data: { activeCallSid: CallSid },
      })

      if (updateResult.count === 1) {
        // We won the race — connect this call to the agent's browser
        await prisma.dialerCall.update({
          where: { id: dialerCall.id },
          data: { status: "ANSWERED" },
        })

        // Redirect call TwiML to connect to agent's browser
        const agentIdentity = dialerSession.agentIdentity || `agent-${dialerSession.agentId}`
        const agentConnectUrl = `${APP_URL}/api/dialer/agent-connect-twiml?identity=${encodeURIComponent(agentIdentity)}`

        if (client) {
          try {
            await (client.calls(CallSid) as any).update({ url: agentConnectUrl })
          } catch (err) {
            console.error("[PARALLEL STATUS] Failed to redirect call:", err)
          }
        } else {
          console.log("[PARALLEL STATUS MOCK] Would redirect call to agent:", agentConnectUrl)
        }

        // Cancel all other QUEUED/RINGING calls in this session
        const otherCalls = await prisma.dialerCall.findMany({
          where: {
            sessionId,
            status: { in: ["QUEUED", "RINGING"] },
            id: { not: dialerCall.id },
          },
        })

        for (const otherCall of otherCalls) {
          if (otherCall.twilioSid && client) {
            try {
              await (client.calls(otherCall.twilioSid) as any).update({ status: "canceled" })
            } catch (err) {
              console.error("[PARALLEL STATUS] Failed to cancel call:", otherCall.twilioSid, err)
            }
          } else if (otherCall.twilioSid) {
            console.log("[PARALLEL STATUS MOCK] Would cancel call:", otherCall.twilioSid)
          }
          await prisma.dialerCall.update({
            where: { id: otherCall.id },
            data: { status: "NO_ANSWER", endedAt: new Date() },
          })
        }

        // Fetch contact details for SSE payload
        const contact = dialerCall.contactId
          ? await prisma.contact.findUnique({ where: { id: dialerCall.contactId } })
          : null

        // Send SSE event to agent
        sendSSE(dialerSession.agentId, "call-answered", {
          callId: dialerCall.id,
          contactId: dialerCall.contactId,
          sessionId,
          contact: contact
            ? {
                id: contact.id,
                firstName: contact.firstName,
                lastName: contact.lastName,
                phone: contact.phone,
                email: contact.email,
                status: contact.status,
                source: contact.source,
              }
            : null,
        })
      } else {
        // Another call already won — cancel this one
        if (client) {
          try {
            await (client.calls(CallSid) as any).update({ status: "completed" })
          } catch (err) {
            console.error("[PARALLEL STATUS] Failed to complete losing call:", err)
          }
        } else {
          console.log("[PARALLEL STATUS MOCK] Would complete losing call:", CallSid)
        }
        await prisma.dialerCall.update({
          where: { id: dialerCall.id },
          data: { status: "NO_ANSWER", endedAt: new Date() },
        })
      }

      return NextResponse.json({ ok: true })
    }

    // Handle no-answer, busy, failed
    if (["no-answer", "busy", "failed"].includes(CallStatus)) {
      await prisma.dialerCall.update({
        where: { id: dialerCall.id },
        data: {
          status: CallStatus === "no-answer" ? "NO_ANSWER" : CallStatus.toUpperCase(),
          endedAt: new Date(),
        },
      })

      // Check if ALL calls in session have ended without answer
      const pendingCalls = await prisma.dialerCall.findMany({
        where: {
          sessionId,
          status: { in: ["QUEUED", "RINGING", "ANSWERED"] },
        },
      })

      const hasActiveCall = await prisma.dialerSession.findUnique({
        where: { id: sessionId },
        select: { activeCallSid: true },
      })

      if (pendingCalls.length === 0 && !hasActiveCall?.activeCallSid) {
        sendSSE(dialerSession.agentId, "all-missed", { sessionId })
      }

      return NextResponse.json({ ok: true })
    }

    // Handle completed
    if (CallStatus === "completed") {
      const duration = CallDuration ? parseInt(CallDuration, 10) : null
      await prisma.dialerCall.update({
        where: { id: dialerCall.id },
        data: {
          status: "COMPLETED",
          endedAt: new Date(),
          ...(duration !== null ? { duration } : {}),
        },
      })

      // If this was the active (answered) call, notify agent it ended
      const sessionData = await prisma.dialerSession.findUnique({
        where: { id: sessionId },
        select: { activeCallSid: true, agentId: true },
      })

      if (sessionData?.activeCallSid === CallSid) {
        sendSSE(sessionData.agentId, "call-ended", {
          callId: dialerCall.id,
          contactId: dialerCall.contactId,
          sessionId,
          duration,
        })
      }

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[PARALLEL STATUS] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
