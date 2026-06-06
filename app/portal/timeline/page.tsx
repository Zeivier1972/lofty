import { redirect } from "next/navigation"
import { getPortalContact } from "@/lib/portal-auth"
import PortalShell from "../_components/portal-shell"
import PortalTimelineClient from "./timeline-client"

export default async function PortalTimelinePage() {
  const contact = await getPortalContact()
  if (!contact) redirect("/portal/login")

  const transaction = contact.transactions[0] || null
  const unread = contact.portalMessages.filter(m => !m.fromClient && !m.isRead).length

  return (
    <PortalShell
      contact={{ firstName: contact.firstName, lastName: contact.lastName, email: contact.email }}
      unreadMessages={unread}
    >
      <PortalTimelineClient
        transaction={transaction ? JSON.parse(JSON.stringify(transaction)) : null}
        contact={JSON.parse(JSON.stringify({ firstName: contact.firstName, status: contact.status }))}
      />
    </PortalShell>
  )
}
