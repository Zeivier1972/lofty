export const dynamic = "force-dynamic"

import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import ListingDetailClient from "./listing-detail-client"

interface PageProps {
  params: { id: string }
}

export default async function ListingDetailPage({ params }: PageProps) {
  const [property, similar] = await Promise.all([
    prisma.property.findUnique({ where: { id: params.id } }).catch(() => null),
    prisma.property.findMany({
      where: { status: "ACTIVE", NOT: { id: params.id } },
      orderBy: { price: "desc" },
      take: 3,
    }).catch(() => []),
  ])

  if (!property) notFound()

  return <ListingDetailClient property={property} similar={similar} />
}
