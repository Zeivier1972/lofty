export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"

// Called by Twilio when a recording is ready, or manually triggered
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { callId, recordingUrl, transcription: providedTranscription } = body

    if (!callId) return NextResponse.json({ error: "callId required" }, { status: 400 })

    const call = await prisma.dialerCall.findUnique({
      where: { id: callId },
      include: { contact: { select: { firstName: true, lastName: true } } },
    })
    if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 })

    let transcription = providedTranscription

    // If no transcription provided, try Twilio transcription endpoint
    if (!transcription && recordingUrl && process.env.TWILIO_ACCOUNT_SID) {
      try {
        const twilio = require("twilio")(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
        const recordings = await twilio.recordings.list({ callSid: call.twilioSid })
        if (recordings[0]) {
          // Basic placeholder — real transcription requires Twilio Voice Intelligence add-on
          transcription = `[Grabación disponible en: ${recordingUrl}]`
        }
      } catch (e) {
        console.error("Twilio transcription error:", e)
      }
    }

    if (!transcription) {
      return NextResponse.json({ error: "No transcription available" }, { status: 400 })
    }

    // Summarize with Claude
    const anthropic = new Anthropic()
    const aiRes = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `Eres un asistente de CRM para bienes raíces. Resume esta llamada de ventas en español en máximo 5 puntos clave (bullet points). Incluye: interés del cliente, siguiente paso acordado, y cualquier objeción mencionada.\n\nTranscripción:\n${transcription.slice(0, 3000)}`,
      }],
    })

    const summary = aiRes.content[0].type === "text" ? aiRes.content[0].text : ""

    await prisma.dialerCall.update({
      where: { id: callId },
      data: {
        transcription: transcription.slice(0, 5000),
        aiSummary: summary,
        ...(recordingUrl && { recordingUrl }),
      },
    })

    // Create note on contact
    if (call.contactId && summary) {
      await prisma.note.create({
        data: {
          content: `📞 Resumen de llamada (AI):\n${summary}`,
          contactId: call.contactId,
        },
      })
    }

    return NextResponse.json({ summary })
  } catch (e) {
    console.error("Call summary error:", e)
    return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 })
  }
}
