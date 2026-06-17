export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import ContactDetailClient from "./contact-detail-client"

export default async function ContactDetailPage({ params }: { params: { id: string } }) {
  const contact = await prisma.contact.findUnique({
    where: { id: params.id },
    include: {
      tags: { include: { tag: true } },
      notes: { include: { author: { select: { name: true } } }, orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }] },
      tasks: { include: { assignedTo: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 30 },
      emails: { orderBy: { createdAt: "desc" }, take: 20 },
      dialerCalls: { orderBy: { createdAt: "desc" }, take: 20 },
      appointments: { orderBy: { startTime: "desc" }, take: 5 },
      transactions: { orderBy: { createdAt: "desc" } },
      pipelineLeads: { include: { stage: { include: { pipeline: true } } }, orderBy: { updatedAt: "desc" } },
      enrollments: { include: { plan: true } },
      propertyInterests: { include: { property: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  })

  if (!contact) notFound()

  const smsMessages = await prisma.sMSMessage.findMany({
    where: { contactId: params.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  const pipeline = await prisma.pipeline.findFirst({
    where: { isDefault: true },
    include: { stages: { orderBy: { order: "asc" } } },
  })

  return <ContactDetailClient
    contact={JSON.parse(JSON.stringify(contact))}
    smsMessages={JSON.parse(JSON.stringify(smsMessages))}
    stages={JSON.parse(JSON.stringify(pipeline?.stages || []))}
    pipelineId={pipeline?.id || ""}
  />
}
