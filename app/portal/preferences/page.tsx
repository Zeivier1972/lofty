export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { getPortalContact } from "@/lib/portal-auth"
import PortalShell from "../_components/portal-shell"
import PreferencesClient from "./preferences-client"
import { prisma } from "@/lib/prisma"

export default async function PreferencesPage() {
  const contact = await getPortalContact()
  if (!contact) redirect("/portal/login")

  const unread = contact.portalMessages.filter(m => !m.fromClient && !m.isRead).length

  const prefs = await prisma.contact.findUnique({
    where: { id: contact.id },
    select: {
      buyerBudgetMin: true,
      buyerBudgetMax: true,
      buyerBedroomsMin: true,
      buyerBathroomsMin: true,
      buyerPropertyType: true,
      buyerMustHaves: true,
      buyerLocation: true,
      buyerTimelineMonths: true,
      buyerPurpose: true,
      matchPrefsCompletedAt: true,
    },
  })

  const initialPrefs = prefs ? {
    purpose: prefs.buyerPurpose || "",
    timelineMonths: prefs.buyerTimelineMonths,
    budgetMin: prefs.buyerBudgetMin,
    budgetMax: prefs.buyerBudgetMax,
    propertyType: prefs.buyerPropertyType || "",
    bedroomsMin: prefs.buyerBedroomsMin,
    bathroomsMin: prefs.buyerBathroomsMin,
    location: prefs.buyerLocation || "",
    mustHaves: prefs.buyerMustHaves || "[]",
  } : null

  return (
    <PortalShell
      contact={{ firstName: contact.firstName, lastName: contact.lastName, email: contact.email }}
      unreadMessages={unread}
    >
      <PreferencesClient initialPrefs={initialPrefs} />
    </PortalShell>
  )
}
