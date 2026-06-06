import { redirect } from "next/navigation"
import { getPortalContact } from "@/lib/portal-auth"
import PortalShell from "../_components/portal-shell"
import PortalPropertiesClient from "./properties-client"

export default async function PortalPropertiesPage() {
  const contact = await getPortalContact()
  if (!contact) redirect("/portal/login")

  const unread = contact.portalMessages.filter(m => !m.fromClient && !m.isRead).length

  return (
    <PortalShell
      contact={{ firstName: contact.firstName, lastName: contact.lastName, email: contact.email }}
      unreadMessages={unread}
    >
      <PortalPropertiesClient
        savedProperties={JSON.parse(JSON.stringify(contact.propertySaves))}
        preferences={{
          budgetMin: contact.buyerBudgetMin,
          budgetMax: contact.buyerBudgetMax,
          bedroomsMin: contact.buyerBedroomsMin,
          location: contact.buyerLocation,
        }}
      />
    </PortalShell>
  )
}
