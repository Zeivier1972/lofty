export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import DialerClient from "./dialer-client"

export default async function DialerPage({ searchParams }: { searchParams?: { contactId?: string } }) {
  let contacts: any[] = []
  let sessions: any[] = []
  let pipelineStages: any[] = []
  let initialContact: any = null

  try {
    const session = await auth()
    ;[contacts, sessions] = await Promise.all([
      prisma.contact.findMany({
        select: {
          id: true, firstName: true, lastName: true, phone: true, phone2: true, status: true, leadScore: true,
          buyerPropertyType: true, buyerLocation: true, buyerBedroomsMin: true, buyerBathroomsMin: true,
          buyerBudgetMin: true, buyerBudgetMax: true, buyerTimelineMonths: true, buyerPurpose: true,
          leadReferrals: { select: { status: true, partner: { select: { name: true } } }, orderBy: { sentAt: "desc" }, take: 1 },
        },
        where: { phone: { not: null } },
        orderBy: { leadScore: "desc" },
        take: 200,
      }),
      prisma.dialerSession.findMany({
        where: { agentId: session?.user?.id },
        include: {
          calls: {
            include: { contact: { select: { id: true, firstName: true, lastName: true } } },
            orderBy: { createdAt: "desc" },
            take: 50,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ])

    const pipeline = await prisma.pipeline.findFirst({
      where: { isDefault: true },
      include: {
        stages: {
          orderBy: { order: "asc" },
          include: {
            leads: {
              include: {
                contact: {
                  select: {
                    id: true, firstName: true, lastName: true, phone: true, phone2: true, status: true, leadScore: true,
                    buyerPropertyType: true, buyerLocation: true, buyerBedroomsMin: true, buyerBathroomsMin: true,
                    buyerBudgetMin: true, buyerBudgetMax: true, buyerTimelineMonths: true, buyerPurpose: true,
                    leadReferrals: { select: { status: true, partner: { select: { name: true } } }, orderBy: { sentAt: "desc" }, take: 1 },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (pipeline) {
      pipelineStages = pipeline.stages.map(s => ({
        id: s.id,
        name: s.name,
        contacts: s.leads
          .map((l: any) => l.contact)
          .filter((c: any) => c && c.phone),
      }))
    }

    // Deep link: /dialer?contactId=xyz pre-loads that contact into the call queue
    if (searchParams?.contactId) {
      initialContact = await prisma.contact.findUnique({
        where: { id: searchParams.contactId },
        select: {
          id: true, firstName: true, lastName: true, phone: true, phone2: true, status: true, leadScore: true,
          buyerPropertyType: true, buyerLocation: true, buyerBedroomsMin: true, buyerBathroomsMin: true,
          buyerBudgetMin: true, buyerBudgetMax: true, buyerTimelineMonths: true, buyerPurpose: true,
          leadReferrals: { select: { status: true, partner: { select: { name: true } } }, orderBy: { sentAt: "desc" }, take: 1 },
        },
      })
    }
  } catch (e) {
    console.error("Dialer page error:", e)
  }

  return (
    <DialerClient
      contacts={JSON.parse(JSON.stringify(contacts))}
      sessions={JSON.parse(JSON.stringify(sessions))}
      pipelineStages={JSON.parse(JSON.stringify(pipelineStages))}
      initialContact={initialContact ? JSON.parse(JSON.stringify(initialContact)) : null}
    />
  )
}
