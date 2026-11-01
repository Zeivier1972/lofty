import { prisma } from "@/lib/prisma"

/**
 * "Pausar a Sofía" for one lead: Catherine is handling them personally.
 *
 * While paused, Sofía sends nothing automatic to that person — no nurture or
 * AI texts, no calls, no drip or alert emails, no Messenger/Instagram/SMS
 * auto-replies. Catherine's own texts, emails and calls from the CRM still go
 * out (unlike Do Not Text / Do Not Call, which block everyone). Inbound
 * messages are still logged and still ring Catherine's bell.
 */

/** Is Sofía paused for this contact, or for any contact with this phone number? */
export async function isSofiaPaused(opts: { contactId?: string | null; phone?: string | null }): Promise<boolean> {
  const digits10 = String(opts.phone || "").replace(/\D/g, "").slice(-10)
  const or: any[] = []
  if (opts.contactId) or.push({ id: opts.contactId })
  if (digits10.length >= 10) or.push({ phone: { contains: digits10 } })
  if (!or.length) return false
  const hit = await prisma.contact.findFirst({ where: { sofiaPausedAt: { not: null }, OR: or }, select: { id: true } }).catch(() => null)
  return !!hit
}

export async function pauseSofia(contactId: string, by: string, reason?: string): Promise<{ pausedPlans: number; cancelledCalls: number }> {
  const active = await prisma.smartPlanEnrollment.findMany({ where: { contactId, status: "ACTIVE" }, select: { id: true } })
  const [, calls] = await Promise.all([
    prisma.smartPlanEnrollment.updateMany({ where: { id: { in: active.map(a => a.id) } }, data: { status: "PAUSED" } }),
    prisma.scheduledCall.updateMany({ where: { contactId, status: "PENDING" }, data: { status: "CANCELLED" } }),
    prisma.contact.update({ where: { id: contactId }, data: { sofiaPausedAt: new Date() } }),
  ])
  await prisma.activity.create({
    data: {
      type: "SOFIA_PAUSED",
      title: `Sofía en pausa para este contacto (${by})`,
      description: [reason, `Se pausaron ${active.length} secuencia(s) y se cancelaron ${calls.count} llamada(s) de Sofía.`].filter(Boolean).join(" — "),
      contactId,
      // Exactly which plans this pause stopped, so resuming restarts those
      // and not plans paused for other reasons (a booking, a STOP).
      metadata: JSON.stringify({ enrollmentIds: active.map(a => a.id) }),
    },
  }).catch(() => {})
  return { pausedPlans: active.length, cancelledCalls: calls.count }
}

export async function resumeSofia(contactId: string, by: string): Promise<{ resumedPlans: number }> {
  const last = await prisma.activity.findFirst({
    where: { contactId, type: "SOFIA_PAUSED" },
    orderBy: { createdAt: "desc" },
    select: { metadata: true },
  })
  let ids: string[] = []
  try { ids = JSON.parse(last?.metadata || "{}").enrollmentIds || [] } catch { ids = [] }
  const resumed = ids.length
    ? await prisma.smartPlanEnrollment.updateMany({ where: { id: { in: ids }, status: "PAUSED" }, data: { status: "ACTIVE", nextStepAt: new Date() } })
    : { count: 0 }
  await prisma.contact.update({ where: { id: contactId }, data: { sofiaPausedAt: null } })
  await prisma.activity.create({
    data: {
      type: "SOFIA_RESUMED",
      title: `Sofía reactivada para este contacto (${by})`,
      description: resumed.count ? `Se reanudaron ${resumed.count} secuencia(s).` : undefined,
      contactId,
    },
  }).catch(() => {})
  return { resumedPlans: resumed.count }
}
