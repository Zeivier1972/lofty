export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import PropertyDetailClient from "./property-detail-client"

export default async function PropertyDetailPage({ params }: { params: { id: string } }) {
  const property = await prisma.property.findUnique({
    where: { id: params.id },
  })

  if (!property) notFound()

  return <PropertyDetailClient property={JSON.parse(JSON.stringify(property))} />
}
