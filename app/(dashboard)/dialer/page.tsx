export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import DialerClient from "./dialer-client"

export default async function DialerPage() {
  let contacts: any[] = []
  let sessions: any[] = []
  let pipelineStages: any[] = []

  try {
    const session = await auth()
    ;[contacts, sessions] = await Promise.all([
      prisma.contact.findMany({
        select: { id: true, firstName: true, lastName: true, phone: true, phone2: true, status: true, leadScore: true },
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
                  select: { id: true, firstName: true, lastName: true, phone: true, phone2: true, status: true, leadScore: true },
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
  } catch (e) {
    console.error("Dialer page error:", e)
  }

  return (
    <DialerClient
      contacts={JSON.parse(JSON.stringify(contacts))}
      sessions={JSON.parse(JSON.stringify(sessions))}
      pipelineStages={JSON.parse(JSON.stringify(pipelineStages))}
    />
  )
}
