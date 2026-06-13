export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { getPortalContact } from "@/lib/portal-auth"
import PortalShell from "../_components/portal-shell"
import PortalDashboardClient from "./dashboard-client"
import { prisma } from "@/lib/prisma"

export default async function PortalDashboardPage() {
  const contact = await getPortalContact()
  if (!contact) redirect("/portal/login")

  const aiConfig = await prisma.aIConfig.findFirst({
    select: { realtorPhone: true, realtorEmail: true, realtorName: true },
  })

  const unread = contact.portalMessages.filter(m => !m.fromClient && !m.isRead).length

  return (
    <PortalShell
      contact={{ firstName: contact.firstName, lastName: contact.lastName, email: contact.email }}
      unreadMessages={unread}
    >
      <PortalDashboardClient
        contact={JSON.parse(JSON.stringify(contact))}
        agentPhone={aiConfig?.realtorPhone || "305-283-0872"}
        agentEmail={aiConfig?.realtorEmail || ""}
        agentName={aiConfig?.realtorName || "Catherine"}
      />
    </PortalShell>
  )
}
