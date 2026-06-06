export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { getPortalContact } from "@/lib/portal-auth"
import PortalShell from "../_components/portal-shell"
import PortalMessagesClient from "./messages-client"
import { prisma } from "@/lib/prisma"

export default async function PortalMessagesPage() {
  const contact = await getPortalContact()
  if (!contact) redirect("/portal/login")

  // Mark agent messages as read
  await prisma.portalMessage.updateMany({
    where: { contactId: contact.id, fromClient: false, isRead: false },
    data: { isRead: true },
  })

  const messages = await prisma.portalMessage.findMany({
    where: { contactId: contact.id },
    orderBy: { createdAt: "asc" },
  })

  const unread = contact.portalMessages.filter(m => !m.fromClient && !m.isRead).length

  return (
    <PortalShell
      contact={{ firstName: contact.firstName, lastName: contact.lastName, email: contact.email }}
      unreadMessages={unread}
    >
      <PortalMessagesClient
        contactId={contact.id}
        contactName={`${contact.firstName} ${contact.lastName}`}
        messages={JSON.parse(JSON.stringify(messages))}
      />
    </PortalShell>
  )
}
