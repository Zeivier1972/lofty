export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import PropertyAlertsClient from "./property-alerts-client"

export default async function PropertyAlertsPage() {
  let buyers: any[] = []
  let properties: any[] = []
  let alertConfig: any = null

  try {
    const session = await auth()
    const userId = session?.user?.id

    ;[buyers, properties, alertConfig] = await Promise.all([
      // Buyers with search criteria
      prisma.contact.findMany({
        where: {
          OR: [
            { buyerBudgetMax: { not: null } },
            { buyerBudgetMin: { not: null } },
            { buyerLocation: { not: null } },
            { buyerBedroomsMin: { not: null } },
          ],
          doNotEmail: false,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          buyerBudgetMin: true,
          buyerBudgetMax: true,
          buyerBedroomsMin: true,
          buyerPropertyType: true,
          buyerLocation: true,
          createdAt: true,
          lastContacted: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      // Active properties (potential matches to send)
      prisma.property.findMany({
        where: { status: "ACTIVE" },
        select: {
          id: true, address: true, city: true, state: true,
          price: true, bedrooms: true, propertyType: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      // Alert config from AI config
      prisma.aIConfig.findFirst().catch(() => null),
    ])
  } catch (e) {
    console.error("Property alerts page error:", e)
  }

  return (
    <PropertyAlertsClient
      buyers={JSON.parse(JSON.stringify(buyers))}
      properties={JSON.parse(JSON.stringify(properties))}
      config={JSON.parse(JSON.stringify(alertConfig))}
    />
  )
}
