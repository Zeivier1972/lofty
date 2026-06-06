import { redirect } from "next/navigation"
import { getPortalContact } from "@/lib/portal-auth"
import PortalShell from "../_components/portal-shell"
import PortalDashboardClient from "./dashboard-client"

export default async function PortalDashboardPage() {
  const contact = await getPortalContact()
  if (!contact) redirect("/portal/login")

  const unread = contact.portalMessages.filter(m => !m.fromClient && !m.isRead).length

  return (
    <PortalShell
      contact={{ firstName: contact.firstName, lastName: contact.lastName, email: contact.email }}
      unreadMessages={unread}
    >
      <PortalDashboardClient contact={JSON.parse(JSON.stringify(contact))} />
    </PortalShell>
  )
}
