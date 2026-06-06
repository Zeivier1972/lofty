import { prisma } from "@/lib/prisma"
import OpenHouseClient from "./open-house-client"

export default async function OpenHousePage() {
  const [openHouses, properties] = await Promise.all([
    prisma.openHouse.findMany({
      include: {
        property: { select: { id: true, address: true, city: true, price: true, images: true } },
        visitors: true,
      },
      orderBy: { date: "desc" },
      take: 50,
    }),
    prisma.property.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, address: true, city: true, price: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ])

  return (
    <OpenHouseClient
      openHouses={JSON.parse(JSON.stringify(openHouses))}
      properties={JSON.parse(JSON.stringify(properties))}
    />
  )
}
