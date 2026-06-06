export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import PropertiesClient from "./properties-client"

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: { status?: string; type?: string; minPrice?: string; maxPrice?: string; search?: string }
}) {
  const where: any = {}
  if (searchParams.status) where.status = searchParams.status
  if (searchParams.type) where.propertyType = searchParams.type
  if (searchParams.minPrice || searchParams.maxPrice) {
    where.price = {}
    if (searchParams.minPrice) where.price.gte = parseFloat(searchParams.minPrice)
    if (searchParams.maxPrice) where.price.lte = parseFloat(searchParams.maxPrice)
  }
  if (searchParams.search) {
    where.OR = [
      { address: { contains: searchParams.search } },
      { city: { contains: searchParams.search } },
      { zip: { contains: searchParams.search } },
    ]
  }

  const [properties, total] = await Promise.all([
    prisma.property.findMany({
      where,
      include: { _count: { select: { interests: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.property.count({ where }),
  ])

  return (
    <PropertiesClient
      properties={JSON.parse(JSON.stringify(properties))}
      total={total}
      filters={searchParams}
    />
  )
}
