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
      activities: { orderBy: { createdAt: "desc" }, take: 20 },
      emails: { orderBy: { createdAt: "desc" }, take: 10 },
      appointments: { orderBy: { startTime: "desc" }, take: 5 },
      transactions: { orderBy: { createdAt: "desc" } },
      pipelineLeads: { include: { stage: { include: { pipeline: true } } } },
      enrollments: { include: { plan: true } },
      propertyInterests: { include: { property: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  })

  if (!contact) notFound()

  return <ContactDetailClient contact={JSON.parse(JSON.stringify(contact))} />
}
