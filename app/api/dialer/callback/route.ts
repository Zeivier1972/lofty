export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Twilio status callback — called for every call status change
export async function POST(req: Request) {
  try {
    const body = await req.formData()
    const sid = body.get("CallSid") as string | null
    const callStatus = body.get("CallStatus") as string | null

    if (!sid || !callStatus) return new NextResponse("ok", { status: 200 })

    const STATUS_MAP: Record<string, string> = {
      completed: "COMPLETED",
      "no-answer": "NO_ANSWER",
      busy: "BUSY",
      failed: "FAILED",
      canceled: "FAILED",
    }

    const mapped = STATUS_MAP[callStatus]
    if (mapped) {
      await prisma.dialerCall.updateMany({
        where: { twilioSid: sid },
        data: {
          status: mapped,
          endedAt: new Date(),
        },
      })
    }

    return new NextResponse("ok", { status: 200 })
  } catch (e) {
    console.error("[dialer/callback] Error:", e)
    return new NextResponse("ok", { status: 200 })
  }
}
