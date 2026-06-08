import { prisma } from "@/lib/prisma"

// Points by event type
const SCORE_EVENTS: Record<string, number> = {
  PROPERTY_VIEWED: 3,
  PROPERTY_SAVED: 8,
  EMAIL_OPENED: 10,
  EMAIL_CLICKED: 15,
  SMS_REPLIED: 15,
  WHATSAPP_REPLIED: 15,
  APPOINTMENT_BOOKED: 30,
  PORTAL_LOGIN: 10,
  SEARCH_PERFORMED: 5,
}

export async function scoreContact(contactId: string): Promise<number> {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600000)

  const [contact, propertyViews, propertySaves, appointments, smsReplies, waReplies, searches] =
    await Promise.all([
      prisma.contact.findUnique({ where: { id: contactId } }),
      prisma.propertyView.count({ where: { contactId, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.propertySave.count({ where: { contactId, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.appointment.count({ where: { contactId, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.sMSMessage.count({ where: { contactId, direction: "INBOUND", createdAt: { gte: thirtyDaysAgo } } }),
      prisma.whatsAppMessage.count({ where: { contactId, direction: "INBOUND", createdAt: { gte: thirtyDaysAgo } } }),
      prisma.searchBehavior.count({ where: { contactId, createdAt: { gte: thirtyDaysAgo } } }),
    ])

  if (!contact) return 0

  let score = 0

  // Engagement signals
  score += Math.min(propertyViews * SCORE_EVENTS.PROPERTY_VIEWED, 30)
  score += Math.min(propertySaves * SCORE_EVENTS.PROPERTY_SAVED, 24)
  score += Math.min(appointments * SCORE_EVENTS.APPOINTMENT_BOOKED, 60)
  score += Math.min(smsReplies * SCORE_EVENTS.SMS_REPLIED, 30)
  score += Math.min(waReplies * SCORE_EVENTS.WHATSAPP_REPLIED, 30)
  score += Math.min(searches * SCORE_EVENTS.SEARCH_PERFORMED, 20)

  // Recency bonus/penalty based on lastContacted
  if (contact.lastContacted) {
    const daysSince = (now.getTime() - contact.lastContacted.getTime()) / (24 * 3600000)
    if (daysSince < 3) score += 20
    else if (daysSince < 7) score += 10
    else if (daysSince < 14) score += 5
    else if (daysSince > 60) score -= 25
    else if (daysSince > 30) score -= 10
  } else {
    // Never contacted — slight penalty for cold leads
    const ageDays = (now.getTime() - contact.createdAt.getTime()) / (24 * 3600000)
    if (ageDays > 30) score -= 15
  }

  // Status weight
  const statusBonus: Record<string, number> = {
    ACTIVE_CLIENT: 30, PROSPECT: 20, LEAD: 5, PAST_CLIENT: 5, SPHERE_OF_INFLUENCE: 3,
  }
  score += statusBonus[contact.status] || 0

  // Buyer/Seller intent bonus
  if (contact.buyerBudgetMax || contact.buyerLocation) score += 10
  if (contact.sellerAddress || contact.sellerEstimatedValue) score += 15

  const finalScore = Math.max(0, Math.min(100, score))

  await prisma.contact.update({
    where: { id: contactId },
    data: { leadScore: finalScore, lastScoreCalculatedAt: now },
  })

  return finalScore
}

export async function decayAllScores() {
  const cutoff = new Date(Date.now() - 14 * 24 * 3600000)
  const staleContacts = await prisma.contact.findMany({
    where: {
      isArchived: false,
      leadScore: { gt: 0 },
      OR: [{ lastScoreCalculatedAt: { lt: cutoff } }, { lastScoreCalculatedAt: null }],
    },
    select: { id: true },
    take: 500,
  })

  await Promise.all(staleContacts.map(c => scoreContact(c.id)))
  return staleContacts.length
}

export function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 70) return { label: "Hot", color: "text-red-600 bg-red-50" }
  if (score >= 40) return { label: "Warm", color: "text-orange-600 bg-orange-50" }
  if (score >= 20) return { label: "Cool", color: "text-blue-600 bg-blue-50" }
  return { label: "Cold", color: "text-gray-500 bg-gray-100" }
}
