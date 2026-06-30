export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { handleCallOutcome } from "@/lib/lead-flow"
import { triggerOutboundCall } from "@/lib/vapi"
import { sendEmail, wrapEmail } from "@/lib/email"

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

async function sendPropertyEmail(input: any, contactId: string): Promise<string> {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { email: true, firstName: true, lastName: true },
    })
    if (!contact?.email) {
      return "No tengo el correo electrónico del lead en el sistema. Pídele su correo para poder enviarle las propiedades."
    }

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
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { address: true, city: true, price: true, bedrooms: true, bathrooms: true, sqft: true, propertyType: true },
    })

    if (props.length === 0) {
      return "No encontré propiedades activas con esos criterios ahora mismo. Le informaré al lead que Catherine lo contactará pronto con opciones exclusivas."
    }

    const propsHtml = props.map((p) => `
      <div style="margin-bottom:20px;padding:16px;border:1px solid #e5e7eb;border-radius:8px;">
        <p style="margin:0 0 4px;font-weight:bold;font-size:16px;">${p.address}${p.city ? ", " + p.city : ""}</p>
        <p style="margin:0;color:#6b7280;font-size:14px;">${p.bedrooms ?? "?"} cuartos · ${p.bathrooms ?? "?"} baños${p.sqft ? " · " + p.sqft.toLocaleString() + " sqft" : ""}</p>
        <p style="margin:8px 0 0;font-size:20px;font-weight:bold;color:#111827;">${p.price ? "$" + p.price.toLocaleString() : "Precio a consultar"}</p>
      </div>
    `).join("")

    const bodyHtml = `
      <h2 style="margin-bottom:8px;">Propiedades seleccionadas para ti</h2>
      <p>Hola ${contact.firstName}, según los criterios que conversamos, aquí tienes algunas opciones que podrían interesarte:</p>
      ${propsHtml}
      <p style="margin-top:24px;">Para más información o para agendar una visita, comunícate directamente con Catherine.</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL || "https://lofty-production.up.railway.app"}/book" style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">Agendar cita con Catherine</a></p>
    `

    await sendEmail({
      to: contact.email,
      subject: `Propiedades seleccionadas para ti — Catherine Gómez Realtor`,
      html: wrapEmail(bodyHtml, { agentName: "Catherine Gómez Realtor" }),
    })

    await prisma.activity.create({
      data: {
        type: "EMAIL_SENT",
        title: "Email de propiedades enviado por Sofía",
        description: `Sofía envió ${props.length} propiedades durante la llamada`,
        contactId,
      },
    })

    return `Email enviado correctamente a ${contact.email} con ${props.length} propiedades.`
  } catch (e: any) {
    console.error("[sendPropertyEmail]", e)
    return "No pude enviar el email en este momento. Por favor inténtalo más tarde."
  }
}

async function createTaskForContact(input: any, contactId: string): Promise<string> {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { assignedToId: true },
    })

    const dueDate = new Date(Date.now() + ((input.due_days ?? 1) * 24 * 60 * 60 * 1000))

    await prisma.task.create({
      data: {
        title: input.title || "Seguimiento de llamada Sofía",
        description: input.description || "Tarea creada automáticamente por Sofía durante una llamada",
        priority: (["HIGH", "MEDIUM", "LOW"].includes(input.priority) ? input.priority : "HIGH") as any,
        status: "PENDING",
        type: "FOLLOW_UP",
        contactId,
        assignedToId: contact?.assignedToId ?? undefined,
        dueDate,
      },
    })

    await prisma.activity.create({
      data: {
        type: "NOTE",
        title: "Tarea creada por Sofía",
        description: input.title || "Seguimiento de llamada Sofía",
        contactId,
      },
    })

    return "Tarea creada exitosamente para Catherine."
  } catch (e: any) {
    console.error("[createTask]", e)
    return "No pude crear la tarea. Inténtalo más tarde."
  }
}

async function sendDocumentToContact(input: any, contactId: string): Promise<string> {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { email: true, firstName: true, lastName: true },
    })
    if (!contact?.email) {
      return "No tengo el correo electrónico del lead. Pídele su correo para enviarle el documento."
    }

    const brochureSetting = await prisma.setting.findUnique({ where: { key: "brochure_documents" } })
    const brochures: { name: string; url: string; description?: string }[] =
      brochureSetting ? JSON.parse(brochureSetting.value) : []

    const query = (input.document_name || "").toLowerCase()
    const doc = brochures.find(b =>
      b.name.toLowerCase().includes(query) || query.includes(b.name.toLowerCase())
    ) || brochures[0]

    if (!doc) {
      return "No hay documentos disponibles en el sistema. Infórmale al lead que Catherine se los enviará directamente."
    }

    const bodyHtml = `
      <h2 style="margin-bottom:8px;">Información solicitada — Catherine Gómez Realtor</h2>
      <p>Hola ${contact.firstName}, aquí tienes el documento que pediste:</p>
      <div style="margin:20px 0;padding:16px;border:1px solid #e5e7eb;border-radius:8px;">
        <p style="margin:0;font-weight:bold;font-size:16px;">${doc.name}</p>
        ${doc.description ? `<p style="margin:4px 0 0;color:#6b7280;">${doc.description}</p>` : ""}
      </div>
      <p><a href="${doc.url}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">Ver / Descargar Documento</a></p>
      <p style="margin-top:24px;">Para más información contacta a Catherine directamente.</p>
    `

    await sendEmail({
      to: contact.email,
      subject: `${doc.name} — Catherine Gómez Realtor`,
      html: wrapEmail(bodyHtml, { agentName: "Catherine Gómez Realtor" }),
    })

    await prisma.activity.create({
      data: {
        type: "EMAIL_SENT",
        title: "Documento enviado por Sofía",
        description: `Sofía envió "${doc.name}" durante la llamada`,
        contactId,
      },
    })

    return `Documento "${doc.name}" enviado correctamente a ${contact.email}.`
  } catch (e: any) {
    console.error("[sendDocument]", e)
    return "No pude enviar el documento. Inténtalo más tarde."
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

    // VAPI newer versions wrap everything under payload.message; older versions send flat.
    // Handle both so the same handler works regardless of VAPI SDK version.
    const msg = payload.message ?? payload
    const { type, call, toolCallList } = msg

    // Log the raw payload shape to help diagnose format issues
    console.log(`[VAPI webhook] type=${type} contactId=${call?.metadata?.contactId} callId=${call?.id} hasMessage=${!!payload.message}`)

    // VAPI may place metadata at call.metadata OR top-level metadata
    const contactId: string | undefined =
      call?.metadata?.contactId || msg.metadata?.contactId || payload.metadata?.contactId

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
        } else if (name === "sendPropertyEmail" && contactId) {
          result = await sendPropertyEmail(args, contactId)
        } else if (name === "createTask" && contactId) {
          result = await createTaskForContact(args, contactId)
        } else if (name === "sendDocument" && contactId) {
          result = await sendDocumentToContact(args, contactId)
        } else {
          result = "OK"
        }

        results.push({ toolCallId: toolCall.id, result })
      }

      return NextResponse.json({ results })
    }

    // ── End of call report ────────────────────────────────────────────────────
    // VAPI sends "end-of-call-report" in most versions; some older versions use
    // "status-update" with status "ended". Handle both.
    const isEndOfCall = type === "end-of-call-report" ||
      (type === "status-update" && (msg.status === "ended" || call?.status === "ended"))

    if (isEndOfCall && contactId) {
      const endedReason: string = msg.endedReason || call?.endedReason || ""
      const transcript: string = msg.transcript || msg.artifact?.transcript || ""
      const summary: string = msg.summary || msg.analysis?.summary || msg.artifact?.summary || ""
      const recordingUrl: string = msg.artifact?.recordingUrl || msg.recordingUrl || call?.recordingUrl || ""
      const duration = call?.endedAt && call?.startedAt
        ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
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
        const sessionId: string | undefined = call?.metadata?.sessionId || msg.metadata?.sessionId
        const sessionIndex: number | undefined = call?.metadata?.sessionIndex ?? msg.metadata?.sessionIndex
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
