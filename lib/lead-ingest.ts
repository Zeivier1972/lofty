import { prisma } from "@/lib/prisma"
import { scoreContact } from "@/lib/scoring"
import { triggerOutboundCall } from "@/lib/vapi"
import { sendEmail } from "@/lib/email"
import { sendSMS, sendWhatsApp, sendWhatsAppTemplate } from "@/lib/sms"

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
  tags?: string[]        // tag names to apply on creation (triggers smart plan enrollment)
}

export async function checkAndEnrollSmartPlans(contactId: string, tagId: string): Promise<void> {
  const plans = await prisma.smartPlan.findMany({
    where: { isActive: true, trigger: `CONTACT_TAGGED:${tagId}` },
    include: { steps: { where: { order: 0 }, take: 1 } },
  })
  for (const plan of plans) {
    const already = await prisma.smartPlanEnrollment.findFirst({
      where: { contactId, planId: plan.id, status: "ACTIVE" },
    })
    if (!already) {
      const delay = plan.steps[0]?.delay ?? 0
      const nextStepAt = new Date(Date.now() + delay * 86400000)
      await prisma.smartPlanEnrollment.create({
        data: { contactId, planId: plan.id, status: "ACTIVE", currentStep: 0, nextStepAt },
      })
      console.log(`[SMART PLAN] Auto-enrolled ${contactId} in "${plan.name}" via tag ${tagId}`)
    }
  }
}

export async function applyTagAndEnroll(contactId: string, tagName: string): Promise<void> {
  const tag = await prisma.tag.upsert({
    where: { name: tagName },
    update: {},
    create: { name: tagName, color: "#10B981" },
  })
  await prisma.contactTag.upsert({
    where: { contactId_tagId: { contactId, tagId: tag.id } },
    create: { contactId, tagId: tag.id },
    update: {},
  })
  await checkAndEnrollSmartPlans(contactId, tag.id)
}

export async function ingestLead(data: LeadData): Promise<{ contactId: string; isNew: boolean }> {
  const { firstName, lastName, email, phone, source, campaign, budget, location, bedroomsMin, propertyType, message, notes, smsConsent, facebookLeadId, tags } = data

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

  // Auto-assign to first stage of default pipeline
  const pipeline = await prisma.pipeline.findFirst({
    where: { isDefault: true },
    include: { stages: { orderBy: { order: "asc" } } },
  })
  const newStage = pipeline?.stages.find(s => s.name === "New Leads") ?? pipeline?.stages[0]
  if (newStage) {
    await prisma.pipelineLead.create({ data: { contactId: contact.id, stageId: newStage.id } })
  }

  // Auto-enroll in Compradores de Primera Vez plan unless international (non-US phone)
  const isInternational = phone ? (phone.startsWith("+") && !phone.startsWith("+1")) : false
  if (!isInternational) {
    prisma.smartPlan.findFirst({ where: { name: { contains: "Compradores de Primera Vez" } } })
      .then(async plan => {
        if (!plan) return
        const already = await prisma.smartPlanEnrollment.findFirst({ where: { contactId: contact.id, planId: plan.id } })
        if (!already) {
          await prisma.smartPlanEnrollment.create({ data: { contactId: contact.id, planId: plan.id, status: "ACTIVE" } })
          console.log(`[INGEST] Enrolled ${contact.id} in plan: ${plan.name}`)
        }
      })
      .catch(e => console.error("[INGEST] FTBO plan enrollment error:", e))
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

  // Apply tags and auto-enroll in matching CONTACT_TAGGED smart plans
  if (tags?.length) {
    for (const tagName of tags) {
      applyTagAndEnroll(contact.id, tagName).catch(e => console.error("[INGEST] Tag apply error:", e))
    }
  }

  // Direct outreach — works without Anthropic API key
  const cfg = await prisma.aIConfig.findFirst()
  const autoSMS   = cfg?.autoRespondSMS   !== false
  const autoEmail = cfg?.autoRespondEmail !== false
  const autoCall  = cfg?.autoCallEnabled  !== false
  // Use real location only — never expose raw campaign names to the lead
  const area = location || "Miami"
  const bookingUrl = (cfg as any)?.calendlyUrl || `${process.env.NEXT_PUBLIC_APP_URL}/book`
  const realtorPhone = cfg?.realtorPhone || "305-283-0872"

  if (phone && autoSMS) {
    const toPhone = phone.startsWith("+") ? phone : `+1${phoneDigits}`
    const isInvestor = tags?.some(t => t.toLowerCase().includes("inversionista"))
    const waNumber = process.env.TWILIO_WHATSAPP_NUMBER

    if (isInvestor && waNumber) {
      // Investor leads → WhatsApp (Colombian investors prefer WhatsApp over SMS)
      const templateSid = process.env.TWILIO_WA_INVESTOR_TEMPLATE_SID
      const waBody = `🏙️ Hola ${firstName}! Soy Sofía, asistente de Catherine Gómez Realtor.\n\nVi que estás interesado en inversiones inmobiliarias en Miami. Catherine es especialista en pre-construcción y retornos de inversión para compradores colombianos y latinos.\n\n📊 ¿Te gustaría ver proyectos con ROI 8-12% anual?\n\n📅 Agenda una consulta gratuita: ${bookingUrl}\n📞 Tel: ${realtorPhone}`

      const sendWA = templateSid
        ? sendWhatsAppTemplate(toPhone, templateSid, { "1": firstName })
        : sendWhatsApp(toPhone, waBody)

      sendWA
        .then(() => {
          console.log(`[INGEST] WhatsApp sent to investor ${toPhone}`)
          prisma.activity.create({
            data: { type: "WHATSAPP", title: "Sofía sent investor welcome via WhatsApp", description: waBody.slice(0, 200), contactId: contact.id },
          }).catch(() => {})
          prisma.whatsAppMessage.create({
            data: { toNumber: `whatsapp:${toPhone}`, fromNumber: `whatsapp:${waNumber}`, body: waBody, direction: "OUTBOUND", status: "SENT", contactId: contact.id },
          }).catch(() => {})
        })
        .catch(e => {
          console.error("[INGEST] WhatsApp failed, falling back to SMS:", e)
          // Fall back to SMS
          const smsBody = `Hola ${firstName}! Soy Sofía de Catherine Gomez Realtor 🏠 Vi que estás interesado en inversiones en Miami. ¿Hablamos? Agenda: ${bookingUrl} · Tel: ${realtorPhone}`
          sendSMS(toPhone, smsBody).catch(() => {})
        })
    } else {
      // Regular leads → SMS
      const interest = propertyType === "PRE_CONSTRUCTION" || (campaign || "").toLowerCase().includes("pre")
        ? "pre-construcción y programas para primeros compradores"
        : propertyType ? `propiedades tipo ${propertyType.toLowerCase().replace("_", " ")} en Miami` : "propiedades en Miami"
      const smsBody = `Hola ${firstName}! Soy Sofía, asistente de Catherine Gomez Realtor 🏠 Vi que estás interesado en ${interest}. ¿Tienes un momentito para hablar? Agenda aquí: ${bookingUrl} · Tel: ${realtorPhone}`
      sendSMS(toPhone, smsBody)
        .then(() => {
          console.log(`[INGEST] SMS sent to ${toPhone}`)
          prisma.activity.create({
            data: { type: "SMS", title: "Sofía sent welcome SMS", description: smsBody.slice(0, 200), contactId: contact.id },
          }).catch(() => {})
        })
        .catch(e => console.error("[INGEST] SMS failed:", e))

      prisma.sMSMessage.create({
        data: { toNumber: toPhone, fromNumber: process.env.TWILIO_PHONE_NUMBER || "", body: smsBody, direction: "OUTBOUND", status: "SENT", contactId: contact.id },
      }).catch(() => {})
    }
  } else {
    console.log(`[INGEST] SMS skipped — phone=${!!phone} autoSMS=${autoSMS}`)
  }

  if (email && autoEmail) {
    const subject = `Hola ${firstName}! Catherine Gomez Realtor está aquí para ayudarte 🏠`
    const html = `<p>Hola ${firstName},</p><p>Gracias por tu interés en propiedades en <strong>${area}</strong>. Soy Sofía, la asistente virtual de <strong>Catherine Gomez Realtor</strong>.</p><p>Catherine tiene más de 20 años de experiencia en Miami y habla español. Estamos listos para ayudarte a encontrar tu hogar ideal.</p><p><a href="${bookingUrl}" style="background:#4F46E5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin:12px 0">Agendar cita gratis con Catherine →</a></p><p>O llámanos al <strong>${realtorPhone}</strong></p>`
    const fromAddress = process.env.RESEND_FROM || "Sofia <sofia@catherinegomezrealtor.com>"
    sendEmail({ to: email, subject, html, text: `Hola ${firstName}! Catherine Gomez Realtor está aquí para ayudarte. Agenda aquí: ${bookingUrl} · Tel: ${realtorPhone}` })
      .then(() => {
        console.log(`[INGEST] Email sent to ${email}`)
        prisma.email.create({
          data: { subject, body: html, fromAddress, toAddress: email, status: "SENT", sentAt: new Date(), contactId: contact.id },
        }).catch(() => {})
        prisma.activity.create({
          data: { type: "EMAIL_SENT", title: "Sofía sent welcome email", description: subject, contactId: contact.id },
        }).catch(() => {})
      })
      .catch(e => console.error("[INGEST] Email failed:", e))
  } else {
    console.log(`[INGEST] Email skipped — email=${!!email} autoEmail=${autoEmail}`)
  }

  // VAPI outbound call — immediate, or schedule for next business hours
  if (phone && autoCall) {
    const toPhone = phone.startsWith("+") ? phone : `+1${phoneDigits}`
    const callOpts = {
      toPhone,
      contactId: contact.id,
      contactName: `${firstName} ${lastName || ""}`.trim(),
      budgetMax: budget ?? null,
      location: location ?? null,
      bedrooms: bedroomsMin ?? null,
      campaign: campaign ?? null,
      propertyType: propertyType ?? null,
      investorProfile: tags?.includes("Investor_colombia") ? "colombia" as const : undefined,
    }

    // Check if we're in business hours (8am–9pm ET, Mon–Sat)
    const nowET = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }))
    const hour = nowET.getHours()
    const day = nowET.getDay() // 0=Sun
    const inHours = day !== 0 && hour >= 8 && hour < 21

    if (inHours) {
      console.log(`[INGEST] Triggering VAPI call to ${toPhone}`)
      triggerOutboundCall(callOpts)
        .then(callId => console.log(`[INGEST] VAPI call initiated: ${callId}`))
        .catch(e => console.error("[INGEST] VAPI call failed:", e))
    } else {
      // Schedule for 8am ET next business day
      const next8am = new Date(nowET)
      next8am.setHours(8, 0, 0, 0)
      if (hour >= 21 || day === 0) next8am.setDate(next8am.getDate() + (day === 6 ? 2 : day === 0 ? 1 : 1))
      // Convert back to UTC offset (ET is UTC-4 or UTC-5; use getTimezoneOffset approach)
      const utcOffset = new Date().getTime() - new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" })).getTime()
      const scheduledAt = new Date(next8am.getTime() + utcOffset)
      console.log(`[INGEST] Outside business hours — scheduling call for ${next8am.toISOString()} ET`)
      prisma.scheduledCall.create({ data: { contactId: contact.id, scheduledAt, attempt: 1, status: "PENDING" } }).catch(() => {})
    }
  } else {
    console.log(`[INGEST] VAPI call skipped — phone=${!!phone} autoCall=${autoCall}`)
  }

  return { contactId: contact.id, isNew: true }
}
