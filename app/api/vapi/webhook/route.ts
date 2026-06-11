export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { handleCallOutcome } from "@/lib/lead-flow"
import { triggerOutboundCall } from "@/lib/vapi"

async function searchProperties(input: any): Promise<string> {
  try {
    const where: any = { status: "ACTIVE" }
    if (input.price_min != null || input.price_max != null) {
      where.price = {}
      if (input.price_min != null) where.price.gte = input.price_min
      if (input.price_max != null) where.price.lte = input.price_max
    }
    if (input.bedrooms_min != null) where.bedrooms = { gte: input.bedrooms_min }
    if (input.property_type) where.propertyType = input.property_type
    if (input.location) {
      where.OR = [
        { city: { contains: input.location, mode: "insensitive" } },
        { address: { contains: input.location, mode: "insensitive" } },
      ]
    }

    const props = await prisma.property.findMany({
      where,
      take: 3,
      orderBy: { createdAt: "desc" },
      select: { address: true, city: true, price: true, bedrooms: true, bathrooms: true, sqft: true, propertyType: true },
    })

    if (props.length === 0) {
      return "No encontré propiedades con esos criterios ahora mismo, pero Catherine tiene opciones exclusivas no listadas. Ofrece agendar una cita con ella directamente."
    }

    // Voice-friendly format (no bullets, readable aloud)
    return props.map((p, i) =>
      `Opción ${i + 1}: ${p.address} en ${p.city || "Miami"}. ` +
      `Precio ${p.price ? "$" + p.price.toLocaleString() : "a consultar"}. ` +
      `${p.bedrooms ?? "?"} cuartos, ${p.bathrooms ?? "?"} baños` +
      (p.sqft ? `, ${p.sqft.toLocaleString()} pies cuadrados` : "") + "."
    ).join(" ")
  } catch {
    return "No pude buscar propiedades en este momento. Ofrece directamente agendar una cita con Catherine."
  }
}

async function updateLead(input: any, contactId: string): Promise<string> {
  try {
    const data: any = {}
    if (input.budget_min != null) data.buyerBudgetMin = input.budget_min
    if (input.budget_max != null) data.buyerBudgetMax = input.budget_max
    if (input.bedrooms_min != null) data.buyerBedroomsMin = input.bedrooms_min
    if (input.location) data.buyerLocation = input.location
    if (input.property_type) data.buyerPropertyType = input.property_type
    if (Object.keys(data).length > 0) {
      await prisma.contact.update({ where: { id: contactId }, data })
    }
    return "Guardado."
  } catch {
    return "No se pudo guardar."
  }
}

async function advanceSession(sessionId: string, completedIndex: number, endedReason: string) {
  const session = await prisma.powerDialSession.findUnique({ where: { id: sessionId } })
  if (!session || session.status !== "ACTIVE") return

  const queue: any[] = JSON.parse(session.contactQueue)
  const callLog: any[] = JSON.parse(session.callLog)
  const justCalled = queue[completedIndex]

  // Determine outcome label
  const isVoicemail = endedReason === "voicemail" || endedReason?.includes("machine")
  const outcome = isVoicemail ? "voicemail" : (endedReason === "customer-ended-call" || endedReason === "assistant-ended-call") ? "connected" : "no_answer"

  const updatedLog = [...callLog, { name: justCalled?.name, phone: justCalled?.phone, outcome, at: new Date().toISOString() }]
  const nextIndex = completedIndex + 1

  if (nextIndex >= queue.length) {
    // All done
    await prisma.powerDialSession.update({
      where: { id: sessionId },
      data: { status: "COMPLETED", currentIndex: nextIndex, callLog: JSON.stringify(updatedLog) },
    })
    console.log(`[PowerDial] Session ${sessionId} completed — ${queue.length} calls done`)
    return
  }

  const next = queue[nextIndex]
  console.log(`[PowerDial] Advancing session ${sessionId} → contact ${nextIndex + 1}/${queue.length}: ${next.name}`)

  // Small delay to avoid VAPI rate limits
  await new Promise(r => setTimeout(r, 2000))

  const callId = await triggerOutboundCall({
    toPhone: next.phone,
    contactId: next.id,
    contactName: next.name,
    skipBusinessHoursCheck: true,
    sessionId,
    sessionIndex: nextIndex,
    voicemailMsg: session.voicemailMsg || undefined,
  })

  await prisma.powerDialSession.update({
    where: { id: sessionId },
    data: {
      currentIndex: nextIndex,
      currentCallId: callId || null,
      callLog: JSON.stringify(updatedLog),
    },
  })
}

export async function POST(req: Request) {
  try {
    const payload = await req.json()
    const { type, call, toolCallList } = payload

    const contactId: string | undefined = call?.metadata?.contactId

    // ── Tool calls ────────────────────────────────────────────────────────────
    if (type === "tool-calls" && toolCallList?.length > 0) {
      const results = []

      for (const toolCall of toolCallList) {
        const name: string = toolCall.function?.name
        const args = toolCall.function?.arguments
          ? (typeof toolCall.function.arguments === "string"
              ? JSON.parse(toolCall.function.arguments)
              : toolCall.function.arguments)
          : {}

        let result = ""

        if (name === "searchProperties") {
          result = await searchProperties(args)
        } else if (name === "bookAppointment") {
          const base = process.env.NEXT_PUBLIC_APP_URL || "https://lofty-production.up.railway.app"
          result = `El link para agendar la cita con Catherine es: ${base}/book`
        } else if (name === "updateLead" && contactId) {
          result = await updateLead(args, contactId)
        } else {
          result = "OK"
        }

        results.push({ toolCallId: toolCall.id, result })
      }

      return NextResponse.json({ results })
    }

    // ── End of call report ────────────────────────────────────────────────────
    if (type === "end-of-call-report" && contactId) {
      const endedReason: string = payload.endedReason || payload.call?.endedReason || ""
      const transcript: string = payload.transcript || payload.artifact?.transcript || ""
      const summary: string = payload.summary || payload.analysis?.summary || payload.artifact?.summary || ""
      const recordingUrl: string = payload.artifact?.recordingUrl || payload.recordingUrl || payload.call?.recordingUrl || ""
      const duration = payload.call?.endedAt && payload.call?.startedAt
        ? Math.round((new Date(payload.call.endedAt).getTime() - new Date(payload.call.startedAt).getTime()) / 1000)
        : 0
      console.log(`[VAPI webhook] end-of-call contactId=${contactId} reason=${endedReason} duration=${duration}s transcript=${transcript.length}ch`)

      try {
        // Save to DialerCall table
        await prisma.dialerCall.create({
          data: {
            contactId,
            phoneNumber: payload.call?.customer?.number || "unknown",
            direction: "OUTBOUND",
            status: endedReason === "customer-ended-call" || endedReason === "assistant-ended-call" ? "COMPLETED" : "NO_ANSWER",
            duration,
            recordingUrl: recordingUrl || null,
            transcription: transcript || null,
            aiSummary: summary || null,
          },
        })

        // Log activity
        await prisma.activity.create({
          data: {
            type: "CALL",
            title: "Llamada AI (Sofía)",
            description: summary ? summary.slice(0, 200) : `Llamada terminada: ${endedReason}`,
            contactId,
          },
        })

        // Update last contacted
        await prisma.contact.update({
          where: { id: contactId },
          data: { lastContacted: new Date() },
        })

        // Trigger automated lead flow based on call outcome
        handleCallOutcome(contactId, endedReason, duration).catch(e =>
          console.error("[lead-flow] handleCallOutcome error:", e)
        )

        // Advance power-dial session if this was a session call
        const sessionId: string | undefined = call?.metadata?.sessionId
        const sessionIndex: number | undefined = call?.metadata?.sessionIndex
        if (sessionId) {
          advanceSession(sessionId, sessionIndex ?? 0, endedReason).catch(e =>
            console.error("[PowerDial] advance error:", e)
          )
        }
      } catch (e) {
        console.error("[VAPI webhook] Error saving call report:", e)
      }
    }

    return NextResponse.json({ received: true })
  } catch (e: any) {
    console.error("[VAPI webhook] Error:", e)
    return NextResponse.json({ error: "Webhook error" }, { status: 500 })
  }
}
