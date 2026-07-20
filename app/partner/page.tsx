export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getPartnerSession } from "@/lib/partner-auth"
import PartnerClient from "./partner-client"

export default async function PartnerPage() {
  const session = await getPartnerSession()
  if (!session) redirect("/partner/login")

  const partner = await prisma.referralPartner.findUnique({
    where: { id: session.partnerId },
    select: { id: true, name: true, isActive: true },
  })
  if (!partner || !partner.isActive) redirect("/partner/login?error=Account+inactive")

  const [referrals, aiConfig, defaultPipeline] = await Promise.all([
    prisma.leadReferral.findMany({
      where: { partnerId: partner.id },
      include: {
        contact: {
          select: {
            id: true, firstName: true, lastName: true, phone: true, email: true,
            buyerLocation: true, buyerBudgetMin: true, buyerBudgetMax: true,
            buyerBedroomsMin: true, buyerPropertyType: true, buyerTimelineMonths: true,
            pipelineLeads: {
              select: { stage: { select: { id: true, name: true } } },
              orderBy: { updatedAt: "desc" },
              take: 1,
            },
            // Full history the partner can now see: the agent's notes + every
            // lead activity (emails opened, calls, texts, saves, stage moves).
            notes: {
              select: { id: true, content: true, createdAt: true, author: { select: { name: true } } },
              orderBy: { createdAt: "desc" }, take: 30,
            },
            activities: {
              select: { id: true, type: true, title: true, description: true, createdAt: true },
              orderBy: { createdAt: "desc" }, take: 60,
            },
          },
        },
        updates: { orderBy: { createdAt: "desc" }, take: 30 },
      },
      orderBy: { sentAt: "desc" },
    }),
    prisma.aIConfig.findFirst({ select: { realtorName: true, realtorPhone: true } }).catch(() => null),
    prisma.pipeline.findFirst({
      where: { isDefault: true },
      include: { stages: { orderBy: { order: "asc" }, select: { id: true, name: true, order: true } } },
    }).catch(() => null),
  ])

  // Follow-up stages the partner can move leads into — connected to the CRM's
  // automation (Contacted 1-4 drip sequence + Drip Campaign)
  const ALLOWED = ["contacted 1", "contacted 2", "contacted 3", "contacted 4", "drip campaign"]
  const crmStages = (defaultPipeline?.stages || [])
    .filter(st => ALLOWED.includes(st.name.toLowerCase().trim()))
    .map(st => ({ id: st.id, name: st.name }))

  // Build a shared, chronological history per lead: the agent's notes (full
  // text) + all lead activity. Partner's own notes/calls are already mirrored
  // into activities, so they show here too — both sides see everything.
  const agentName = aiConfig?.realtorName || "Catherine Gomez"
  const iconForType = (t: string): string => {
    if (/EMAIL/i.test(t)) return "📬"
    if (/CALL/i.test(t)) return "📞"
    if (/SMS|TEXT|WHATSAPP/i.test(t)) return "💬"
    if (/SAVE|PROPERTY/i.test(t)) return "💜"
    if (/PIPELINE|STAGE|REFERR/i.test(t)) return "🔄"
    if (/NOTE/i.test(t)) return "📝"
    return "•"
  }
  const referralsOut = (referrals as any[]).map(r => {
    const c = r.contact || {}
    const notes = (c.notes || []).map((n: any) => ({
      id: `note-${n.id}`, ts: n.createdAt, icon: "📝",
      who: n.author?.name || agentName, text: n.content,
    }))
    const acts = (c.activities || [])
      // Drop the empty "Note added" activity — the note's real text comes from notes above.
      .filter((a: any) => !(a.type === "NOTE_ADDED" && !a.description))
      .map((a: any) => ({
        id: `act-${a.id}`, ts: a.createdAt, icon: iconForType(a.type),
        who: "", text: [a.title, a.description].filter(Boolean).join(" — "),
      }))
    const history = [...notes, ...acts]
      .sort((x, y) => +new Date(y.ts) - +new Date(x.ts))
      .slice(0, 80)
    const { notes: _n, activities: _a, ...contactRest } = c
    return { ...r, contact: contactRest, history }
  })

  return (
    <PartnerClient
      partnerName={partner.name}
      agentName={agentName}
      agentPhone={aiConfig?.realtorPhone || "305-283-0872"}
      referrals={JSON.parse(JSON.stringify(referralsOut))}
      crmStages={crmStages}
    />
  )
}
