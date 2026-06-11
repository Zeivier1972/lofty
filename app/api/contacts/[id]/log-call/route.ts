export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { handleCallOutcome } from "@/lib/lead-flow"

// POST: log a manual call made by Catherine and trigger lead-flow
// body: { outcome: "connected"|"voicemail"|"no_answer", note?: string, callerName?: string }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { outcome, note, callerName = "Catherine" } = await req.json()
    const contactId = params.id

    // Map outcome to VAPI-style endedReason so handleCallOutcome works identically
    const endedReason =
      outcome === "connected" ? "customer-ended-call" :
      outcome === "voicemail"  ? "voicemail" :
      "customer-did-not-answer"

    // Log activity
    await prisma.activity.create({
      data: {
        type: "CALL",
        title: `Llamada (${callerName})`,
        description: note || `Llamada manual — ${outcome}`,
        contactId,
      },
    })

    // Update last contacted
    await prisma.contact.update({
      where: { id: contactId },
      data: { lastContacted: new Date() },
    })

    // Advance pipeline stage + trigger Sofia follow-up flows (same as VAPI webhook)
    handleCallOutcome(contactId, endedReason, outcome === "connected" ? 60 : 0).catch(e =>
      console.error("[log-call] handleCallOutcome error:", e)
    )

    return NextResponse.json({ logged: true })
  } catch (e: any) {
    console.error("[log-call] error:", e)
    return NextResponse.json({ error: "Failed to log call" }, { status: 500 })
  }
}
