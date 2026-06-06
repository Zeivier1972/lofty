export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import ListingsClient from "./listings-client"

export default async function ListingsPage() {
  const properties = await prisma.property.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  }).catch(() => [])

  return <ListingsClient properties={properties} />
}
