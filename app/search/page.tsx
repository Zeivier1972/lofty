import { prisma } from "@/lib/prisma"
import SearchClient from "./search-client"

interface SearchParams {
  type?: string
  minPrice?: string
  maxPrice?: string
  beds?: string
  city?: string
  status?: string
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const where: Record<string, unknown> = {}

  if (searchParams.type) where.type = searchParams.type
  if (searchParams.city) where.city = { contains: searchParams.city }
  if (searchParams.status) where.status = searchParams.status
  else where.status = "ACTIVE"

  if (searchParams.minPrice || searchParams.maxPrice) {
    where.price = {}
    if (searchParams.minPrice) (where.price as Record<string, unknown>).gte = Number(searchParams.minPrice)
    if (searchParams.maxPrice) (where.price as Record<string, unknown>).lte = Number(searchParams.maxPrice)
  }

  if (searchParams.beds) {
    where.bedrooms = { gte: Number(searchParams.beds) }
  }

  const properties = await prisma.property.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return <SearchClient properties={JSON.parse(JSON.stringify(properties))} filters={searchParams} />
}
