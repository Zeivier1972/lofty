import { prisma } from "@/lib/prisma"
import { scoreContact } from "@/lib/scoring"
import { triggerOutboundCall } from "@/lib/vapi"

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

  // Score + AI follow-up (fire and forget)
  scoreContact(contact.id).catch(() => {})
  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ai/trigger`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trigger: "NEW_LEAD", contactId: contact.id }),
  }).catch(() => {})

  // VAPI outbound call (30s delay)
  if (phone) {
    const toPhone = phone.startsWith("+") ? phone : `+1${phoneDigits}`
    setTimeout(() => {
      triggerOutboundCall({
        toPhone,
        contactId: contact.id,
        contactName: `${firstName} ${lastName || ""}`.trim(),
        budgetMax: budget ?? null,
        location: location ?? null,
        bedrooms: bedroomsMin ?? null,
        campaign: campaign ?? null,
        propertyType: propertyType ?? null,
      }).catch(() => {})
    }, 30_000)
  }

  return { contactId: contact.id, isNew: true }
}
