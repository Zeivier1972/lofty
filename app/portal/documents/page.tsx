export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { getPortalContact } from "@/lib/portal-auth"
import PortalShell from "../_components/portal-shell"
import PortalDocumentsClient from "./documents-client"

export default async function PortalDocumentsPage() {
  const contact = await getPortalContact()
  if (!contact) redirect("/portal/login")

  const transaction = contact.transactions[0] || null
  const unread = contact.portalMessages.filter(m => !m.fromClient && !m.isRead).length

  return (
    <PortalShell
      contact={{ firstName: contact.firstName, lastName: contact.lastName, email: contact.email }}
      unreadMessages={unread}
    >
      <PortalDocumentsClient transaction={transaction ? JSON.parse(JSON.stringify(transaction)) : null} />
    </PortalShell>
  )
}
