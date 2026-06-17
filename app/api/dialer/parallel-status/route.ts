export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendSSE } from "@/lib/dialer-sse"
import twilio from "twilio"

function getTwilio() {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return null
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
}

export async function POST(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const callDbId = params.get("callDbId")
  const sessionId = params.get("sessionId")
  const agentId = params.get("agentId")

  const formData = await req.formData()
  const callSid = formData.get("CallSid") as string
  const callStatus = formData.get("CallStatus") as string
  const answeredBy = formData.get("AnsweredBy") as string | null

  console.log(`[ParallelStatus] call=${callDbId} session=${sessionId} status=${callStatus} answeredBy=${answeredBy}`)

  if (!callDbId || !sessionId || !agentId) {
    return new NextResponse("OK", { status: 200 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  // Human answered
  if (callStatus === "in-progress") {
    // Answering machine detection: skip if voicemail
    if (answeredBy && answeredBy.startsWith("machine")) {
      console.log(`[ParallelStatus] Voicemail detected on ${callSid} — hanging up`)
      const client = getTwilio()
      if (client) {
        await client.calls(callSid).update({ status: "completed" } as any).catch(() => {})
      }
      await prisma.dialerCall.update({
        where: { id: callDbId },
        data: { status: "COMPLETED", disposition: "VOICEMAIL", endedAt: new Date() },
      }).catch(() => {})
      return new NextResponse("OK", { status: 200 })
    }

    // Race-condition-safe first-answer claim:
    // Only the first call to set activeCallSid wins
    const claimed = await prisma.$executeRawUnsafe(
      `UPDATE "DialerSession" SET "activeCallSid" = $1 WHERE id = $2 AND "activeCallSid" IS NULL`,
      callSid,
      sessionId
    )

    if (claimed === 1) {
      // WE WON — this is the first human answer
      console.log(`[ParallelStatus] First answer! Bridging ${callSid} to agent ${agentId}`)

      // Update this call's status
      await prisma.dialerCall.update({
        where: { id: callDbId },
        data: { status: "COMPLETED", disposition: "REACHED" },
      }).catch(() => {})

      // Redirect the answered call to connect Catherine's browser
      const client = getTwilio()
      const agentIdentity = `agent-${agentId}`
      const connectUrl = `${appUrl}/api/dialer/agent-connect-twiml?identity=${encodeURIComponent(agentIdentity)}`
      if (client) {
        await client.calls(callSid).update({ url: connectUrl, method: "POST" } as any).catch(e => {
          console.error("[ParallelStatus] Failed to redirect call:", e)
        })
      }

      // Cancel all other RINGING/QUEUED calls in this session
      const otherCalls = await prisma.dialerCall.findMany({
        where: {
          sessionId,
          id: { not: callDbId },
          status: { in: ["QUEUED", "RINGING"] },
        },
      })
      const cancelClient = getTwilio()
      for (const other of otherCalls) {
        if (other.twilioSid && cancelClient) {
          cancelClient.calls(other.twilioSid).update({ status: "canceled" } as any).catch(() => {})
        }
        await prisma.dialerCall.update({
          where: { id: other.id },
          data: { status: "NO_ANSWER", endedAt: new Date() },
        }).catch(() => {})
      }

      // Fetch full contact card for SSE payload
      const dialerCall = await prisma.dialerCall.findUnique({
        where: { id: callDbId },
        include: {
          contact: {
            select: {
              id: true, firstName: true, lastName: true, email: true,
              phone: true, phone2: true, source: true, status: true,
              lastContacted: true,
            },
          },
        },
      })

      // Push SSE event to Catherine's browser
      sendSSE(agentId, "call-answered", {
        callId: callDbId,
        sessionId,
        twilioSid: callSid,
        contactId: dialerCall?.contactId,
        contact: dialerCall?.contact || null,
      })

      // Update session stats
      await prisma.dialerSession.update({
        where: { id: sessionId },
        data: { answered: { increment: 1 }, totalCalls: { increment: 1 } },
      }).catch(() => {})

    } else {
      // Another call already won — drop this one
      console.log(`[ParallelStatus] Another call already answered for session ${sessionId} — dropping ${callSid}`)
      const client = getTwilio()
      if (client) {
        await client.calls(callSid).update({ status: "completed" } as any).catch(() => {})
      }
      await prisma.dialerCall.update({
        where: { id: callDbId },
        data: { status: "NO_ANSWER", endedAt: new Date() },
      }).catch(() => {})
    }
  }

  // Call ended
  if (["completed", "no-answer", "busy", "failed", "canceled"].includes(callStatus)) {
    const statusMap: Record<string, string> = {
      completed: "COMPLETED",
      "no-answer": "NO_ANSWER",
      busy: "BUSY",
      failed: "FAILED",
      canceled: "NO_ANSWER",
    }
    await prisma.dialerCall.update({
      where: { id: callDbId },
      data: {
        status: statusMap[callStatus] || callStatus.toUpperCase(),
        endedAt: new Date(),
      },
    }).catch(() => {})

    // Check if this was the active call (call ended by contact hanging up)
    const sess = await prisma.dialerSession.findUnique({ where: { id: sessionId } }).catch(() => null)
    if (sess && (sess as any).activeCallSid === callSid) {
      sendSSE(agentId, "call-ended", { callId: callDbId, sessionId })
      await prisma.dialerSession.update({
        where: { id: sessionId },
        data: { status: "IDLE" },
      }).catch(() => {})
    }

    // Check if ALL calls in session missed (no active call set)
    if (!sess || !(sess as any).activeCallSid) {
      const remainingActive = await prisma.dialerCall.count({
        where: { sessionId, status: { in: ["QUEUED", "RINGING"] } },
      })
      if (remainingActive === 0) {
        sendSSE(agentId, "all-missed", { sessionId })
        await prisma.dialerSession.update({
          where: { id: sessionId },
          data: { totalCalls: { increment: 1 }, noAnswers: { increment: 1 } },
        }).catch(() => {})
      }
    }
  }

  return new NextResponse("OK", { status: 200 })
}
