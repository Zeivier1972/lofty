export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { initiateCall } from "@/lib/sms"
import { handleCallOutcome } from "@/lib/lead-flow"

// Map Twilio/dialer statuses to VAPI-compatible end reasons
const TWILIO_STATUS_MAP: Record<string, string> = {
  COMPLETED: "completed",            // answered — NOT in NO_ANSWER_REASONS → triggers Warm stage
  NO_ANSWER: "customer-did-not-answer",
  BUSY: "customer-busy",
  FAILED: "pipeline-error",
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { contactId, phoneNumber, sessionId, notes } = await req.json()

  const call = await prisma.dialerCall.create({
    data: {
      contactId,
      phoneNumber,
      sessionId,
      status: "QUEUED",
      direction: "OUTBOUND",
      agentId: session?.user?.id,
    },
  })

  try {
    const twimlUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/dialer/twiml?callId=${call.id}`
    const twilioSid = await initiateCall(phoneNumber, twimlUrl)

    await prisma.dialerCall.update({
      where: { id: call.id },
      data: { twilioSid, status: "RINGING", startedAt: new Date() },
    })

    // Log activity
    if (contactId) {
      await prisma.activity.create({
        data: {
          type: "CALL_MADE",
          title: "Outbound call initiated",
          description: `Called ${phoneNumber}`,
          contactId,
          userId: session?.user?.id,
        },
      })
    }

    return NextResponse.json({ callId: call.id, twilioSid, status: "RINGING" })
  } catch (error) {
    await prisma.dialerCall.update({
      where: { id: call.id },
      data: { status: "FAILED" },
    })
    return NextResponse.json({ callId: call.id, status: "FAILED", error: String(error) })
  }
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { callId, status, notes, disposition, duration } = await req.json()

  const call = await prisma.dialerCall.update({
    where: { id: callId },
    data: {
      status,
      notes,
      disposition,
      duration,
      endedAt: ["COMPLETED", "NO_ANSWER", "BUSY", "FAILED"].includes(status) ? new Date() : undefined,
    },
  })

  // Update session stats
  if (call.sessionId) {
    const sess = await prisma.dialerSession.findUnique({ where: { id: call.sessionId } })
    if (sess) {
      await prisma.dialerSession.update({
        where: { id: call.sessionId },
        data: {
          totalCalls: { increment: 1 },
          answered: status === "COMPLETED" ? { increment: 1 } : undefined,
          voicemails: disposition === "VOICEMAIL" ? { increment: 1 } : undefined,
          noAnswers: status === "NO_ANSWER" ? { increment: 1 } : undefined,
        },
      })
    }
  }

  // Advance the lead pipeline stage — same logic as Sofia, but flagged as agent call
  if (call.contactId && ["COMPLETED", "NO_ANSWER", "BUSY", "FAILED"].includes(status)) {
    const endedReason = TWILIO_STATUS_MAP[status] ?? "customer-did-not-answer"
    const durationSecs = typeof duration === "number" ? duration : 0
    try {
      await handleCallOutcome(call.contactId, endedReason, durationSecs, true)
    } catch (err) {
      console.error("[dialer/call] handleCallOutcome failed:", err)
    }
  }

  return NextResponse.json(call)
}
