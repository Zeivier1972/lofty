import { prisma } from "@/lib/prisma"
import { scoreContact } from "@/lib/scoring"
import { triggerOutboundCall } from "@/lib/vapi"
import { sendEmail } from "@/lib/email"
import { sendSMS } from "@/lib/sms"

export interface LeadData {
  firstName: string
  lastName?: string
  email?: string
  phone?: string
  source: string          // FACEBOOK | GOOGLE | ZAPIER | MANYCHAT | WEBSITE | SMS | etc.
  campaign?: string       // ad campaign name if available
  budget?: number | null
  location?: string
  bedroomsMin?: number | null
  propertyType?: string
  message?: string
  notes?: string          // extra context from form answers
  smsConsent?: boolean
  facebookLeadId?: string
}

export async function ingestLead(data: LeadData): Promise<{ contactId: string; isNew: boolean }> {
  const { firstName, lastName, email, phone, source, campaign, budget, location, bedroomsMin, propertyType, message, notes, smsConsent, facebookLeadId } = data

  const phoneDigits = phone ? phone.replace(/\D/g, "").slice(-10) : null

  // Deduplicate by email or phone
  const existing = email
    ? await prisma.contact.findFirst({ where: { email } })
    : phoneDigits
      ? await prisma.contact.findFirst({ where: { phone: { contains: phoneDigits } } })
      : null

  if (existing) {
    // Update with any new info
    await prisma.contact.update({
      where: { id: existing.id },
      data: {
        ...(smsConsent && { smsTCPAConsent: true, smsTCPAConsentDate: new Date(), smsTCPAConsentMethod: source.toLowerCase() }),
        ...(facebookLeadId && { facebookLeadId }),
        ...(budget && { buyerBudgetMax: budget }),
        ...(location && { buyerLocation: location }),
        ...(bedroomsMin && { buyerBedroomsMin: bedroomsMin }),
        ...(propertyType && { buyerPropertyType: propertyType }),
      },
    })
    if (message) {
      await prisma.note.create({ data: { content: `[${source}] ${message}`, contactId: existing.id } })
    }
    return { contactId: existing.id, isNew: false }
  }

  // Create new contact
  const contact = await prisma.contact.create({
    data: {
      firstName,
      lastName: lastName || "",
      email: email || undefined,
      phone: phone ? (phone.startsWith("+") ? phone : `+1${phoneDigits}`) : undefined,
      source,
      status: "LEAD",
      smsTCPAConsent: !!smsConsent,
      smsTCPAConsentDate: smsConsent ? new Date() : undefined,
      smsTCPAConsentMethod: smsConsent ? source.toLowerCase() : undefined,
      facebookLeadId: facebookLeadId || undefined,
      buyerBudgetMax: budget || undefined,
      buyerLocation: location || undefined,
      buyerBedroomsMin: bedroomsMin || undefined,
      buyerPropertyType: propertyType || undefined,
    },
  })

  // Auto-assign to "New" stage in default pipeline
  const pipeline = await prisma.pipeline.findFirst({
    where: { isDefault: true },
    include: { stages: { orderBy: { order: "asc" } } },
  })
  const newStage = pipeline?.stages.find(s => s.name === "New") ?? pipeline?.stages[0]
  if (newStage) {
    await prisma.pipelineLead.create({ data: { contactId: contact.id, stageId: newStage.id } })
  }

  // Note with campaign info and form answers
  const noteContent = [
    campaign ? `[Campaña: ${campaign}]` : "",
    message || "",
    notes || "",
  ].filter(Boolean).join(" | ")
  if (noteContent) {
    await prisma.note.create({ data: { content: noteContent, contactId: contact.id } })
  }

  // AI notification
  await prisma.aINotification.create({
    data: {
      type: "NEW_LEAD",
      title: `Nuevo lead: ${firstName} ${lastName || ""} — ${source}`,
      body: [
        campaign ? `Campaña: ${campaign}` : "",
        phone ? `Tel: ${phone}` : "",
        email ? `Email: ${email}` : "",
      ].filter(Boolean).join(" · "),
      priority: "HIGH",
      contactId: contact.id,
    },
  })

  // Alert Catherine (fire and forget)
  prisma.aIConfig.findFirst({ select: { realtorEmail: true, realtorPhone: true, realtorName: true } }).then(cfg => {
    const lines = [
      `Nombre: ${firstName} ${lastName || ""}`.trim(),
      phone ? `Tel: ${phone}` : "",
      email ? `Email: ${email}` : "",
      campaign ? `Campaña: ${campaign}` : "",
      location ? `Área: ${location}` : "",
    ].filter(Boolean)

    if (cfg?.realtorEmail) {
      sendEmail({
        to: cfg.realtorEmail,
        subject: `🆕 Nuevo lead: ${firstName} ${lastName || ""} — ${source}`,
        html: `<p>Hola ${cfg.realtorName || "Catherine"},</p><p>Acaba de llegar un nuevo lead desde <strong>${source}</strong>:</p><ul>${lines.map(l => `<li>${l}</li>`).join("")}</ul><p><a href="${process.env.NEXT_PUBLIC_APP_URL}/contacts/${contact.id}">Ver en el CRM →</a></p>`,
        text: `Nuevo lead (${source}):\n${lines.join("\n")}\n\nVer en CRM: ${process.env.NEXT_PUBLIC_APP_URL}/contacts/${contact.id}`,
      }).catch(() => {})
    }
    if (cfg?.realtorPhone && phone) {
      sendSMS(
        cfg.realtorPhone.startsWith("+") ? cfg.realtorPhone : `+1${cfg.realtorPhone.replace(/\D/g, "")}`,
        `🆕 Nuevo lead (${source}): ${firstName} ${lastName || ""} ${phone ? `· ${phone}` : ""} ${campaign ? `· ${campaign}` : ""}`.trim()
      ).catch(() => {})
    }
  }).catch(() => {})

  // Score (fire and forget)
  scoreContact(contact.id).catch(() => {})

  // Direct outreach — works without Anthropic API key
  const cfg = await prisma.aIConfig.findFirst()
  const autoSMS   = cfg?.autoRespondSMS   !== false
  const autoEmail = cfg?.autoRespondEmail !== false
  const autoCall  = cfg?.autoCallEnabled  !== false
  const area = location || campaign || "Miami"
  const bookingUrl = (cfg as any)?.calendlyUrl || `${process.env.NEXT_PUBLIC_APP_URL}/book`
  const realtorPhone = cfg?.realtorPhone || "305-283-0872"

  if (phone && autoSMS) {
    const toPhone = phone.startsWith("+") ? phone : `+1${phoneDigits}`
    const smsBody = `Hola ${firstName}! Soy Sofía, asistente de Catherine Gomez Realtor en Miami 🏠 Vi que estás buscando propiedad en ${area}. ¿Tienes un momentito para hablar? Llámanos al ${realtorPhone} o agenda aquí: ${bookingUrl} | Hi ${firstName}! I'm Sofia from Catherine Gomez Realtor. Interested in ${area} properties — call us at ${realtorPhone} or book here: ${bookingUrl}`
    sendSMS(toPhone, smsBody)
      .then(() => console.log(`[INGEST] SMS sent to ${toPhone}`))
      .catch(e => console.error("[INGEST] SMS failed:", e))

    prisma.sMSMessage.create({
      data: { toNumber: toPhone, fromNumber: process.env.TWILIO_PHONE_NUMBER || "", body: smsBody, direction: "OUTBOUND", status: "SENT", contactId: contact.id },
    }).catch(() => {})
  } else {
    console.log(`[INGEST] SMS skipped — phone=${!!phone} autoSMS=${autoSMS}`)
  }

  if (email && autoEmail) {
    const subject = `Hola ${firstName}! Catherine Gomez Realtor está aquí para ayudarte 🏠`
    const html = `<p>Hola ${firstName},</p><p>Gracias por tu interés en propiedades en <strong>${area}</strong>. Soy Sofía, la asistente virtual de <strong>Catherine Gomez Realtor</strong>.</p><p>Catherine tiene más de 20 años de experiencia en Miami y habla español. Estamos listos para ayudarte a encontrar tu hogar ideal.</p><p><a href="${bookingUrl}" style="background:#4F46E5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin:12px 0">Agendar cita gratis con Catherine →</a></p><p>O llámanos al <strong>${realtorPhone}</strong></p><hr/><p>Hi ${firstName}, thanks for your interest in ${area} properties. Catherine Gomez has 20+ years of Miami real estate experience. Call us at ${realtorPhone} or <a href="${bookingUrl}">schedule a free consultation</a>.</p>`
    sendEmail({ to: email, subject, html, text: `Hola ${firstName}! Catherine Gomez Realtor está aquí para ayudarte. Agenda aquí: ${bookingUrl} · Tel: ${realtorPhone}` })
      .then(() => console.log(`[INGEST] Email sent to ${email}`))
      .catch(e => console.error("[INGEST] Email failed:", e))
  } else {
    console.log(`[INGEST] Email skipped — email=${!!email} autoEmail=${autoEmail}`)
  }

  // VAPI outbound call — immediate (Sofia calls the lead right away)
  if (phone && autoCall) {
    const toPhone = phone.startsWith("+") ? phone : `+1${phoneDigits}`
    console.log(`[INGEST] Triggering VAPI call to ${toPhone}`)
    triggerOutboundCall({
      toPhone,
      contactId: contact.id,
      contactName: `${firstName} ${lastName || ""}`.trim(),
      budgetMax: budget ?? null,
      location: location ?? null,
      bedrooms: bedroomsMin ?? null,
      campaign: campaign ?? null,
      propertyType: propertyType ?? null,
    }).then(callId => console.log(`[INGEST] VAPI call initiated: ${callId}`))
      .catch(e => console.error("[INGEST] VAPI call failed:", e))
  } else {
    console.log(`[INGEST] VAPI call skipped — phone=${!!phone} autoCall=${autoCall}`)
  }

  // AI agent for personalized follow-up (requires ANTHROPIC_API_KEY)
  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ai/trigger`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trigger: "NEW_LEAD", contactId: contact.id }),
  }).catch(e => console.error("[INGEST] AI trigger fetch failed:", e))

  return { contactId: contact.id, isNew: true }
}
