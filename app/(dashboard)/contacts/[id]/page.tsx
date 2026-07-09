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
      propertySaves: { include: { property: true }, where: { isActive: true }, orderBy: { createdAt: "desc" } },
      assignedTo: { select: { id: true, name: true, email: true } },
      leadReferrals: {
        include: {
          partner: { select: { id: true, name: true, brokerage: true, phone: true, email: true } },
          updates: { orderBy: { createdAt: "desc" } },
        },
        orderBy: { sentAt: "desc" },
      },
    },
  })

  if (!contact) notFound()

  // Opening a lead = implicit acknowledgment: clear their unread notifications
  // so the bell badge reflects only leads Catherine hasn't looked at yet.
  await prisma.aINotification.updateMany({
    where: { contactId: params.id, isRead: false },
    data: { isRead: true },
  }).catch(() => {})

  // Properties Sofia sent via match-alert emails
  const rawAlerts = await prisma.propertyAlertSent.findMany({
    where: { contactId: params.id },
    orderBy: { sentAt: "desc" },
    take: 30,
  })
  const alertPropertyIds = rawAlerts.map(a => a.propertyId)
  const alertProperties = alertPropertyIds.length > 0
    ? await prisma.property.findMany({
        where: { id: { in: alertPropertyIds } },
        select: { id: true, address: true, city: true, state: true, price: true, bedrooms: true, bathrooms: true, images: true, mlsId: true },
      })
    : []
  const alertsSent = rawAlerts
    .map(a => ({ ...a, property: alertProperties.find(p => p.id === a.propertyId) || null }))
    .filter(a => a.property !== null)

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
    alertsSent={JSON.parse(JSON.stringify(alertsSent))}
  />
}
