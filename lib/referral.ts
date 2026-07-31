import { prisma } from "@/lib/prisma"

// Referral statuses that mean the lead is actively owned by a PARTNER realtor
// (same definition the dialer uses to skip partner leads).
export const ACTIVE_REFERRAL_STATUSES = ["SENT", "CONTACTED", "SHOWING", "UNDER_CONTRACT"]

// True when the contact is currently assigned to a partner realtor. Used to keep
// Catherine's automations (auto follow-up tasks, etc.) off leads that belong to
// someone else.
export async function isAssignedToPartner(contactId: string | null | undefined): Promise<boolean> {
  if (!contactId) return false
  const ref = await prisma.leadReferral.findFirst({
    where: { contactId, status: { in: ACTIVE_REFERRAL_STATUSES } },
    select: { id: true },
  })
  return !!ref
}

// Filter a list of contactIds down to those NOT assigned to a partner.
export async function excludePartnerAssigned(contactIds: string[]): Promise<string[]> {
  if (contactIds.length === 0) return []
  const refs = await prisma.leadReferral.findMany({
    where: { contactId: { in: contactIds }, status: { in: ACTIVE_REFERRAL_STATUSES } },
    select: { contactId: true },
  })
  const assigned = new Set(refs.map(r => r.contactId))
  return contactIds.filter(id => !assigned.has(id))
}
