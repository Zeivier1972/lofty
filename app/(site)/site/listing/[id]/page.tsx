export const dynamic = "force-dynamic"

import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { fetchPrimaryPhotos } from "@/lib/bridge"
import ListingDetailClient from "./listing-detail-client"

interface PageProps {
  params: { id: string }
}

function hasPhoto(images: string | null) {
  try { const a = JSON.parse(images || "[]"); return Array.isArray(a) && a.some(Boolean) } catch { return false }
}

export default async function ListingDetailPage({ params }: PageProps) {
  const [property, similar, aiConfig] = await Promise.all([
    prisma.property.findUnique({ where: { id: params.id } }).catch(() => null),
    prisma.property.findMany({
      where: { status: "ACTIVE", NOT: { id: params.id } },
      orderBy: { price: "desc" },
      take: 3,
    }).catch(() => []),
    prisma.aIConfig.findFirst({
      select: { realtorName: true, realtorPhone: true, realtorEmail: true },
    }).catch(() => null),
  ])

  if (!property) notFound()

  // Enrich main property photo if missing
  let enrichedProperty = property
  if (!hasPhoto(property.images) && property.mlsId) {
    const photoMap: Record<string, string> = await fetchPrimaryPhotos([property.mlsId]).catch(() => ({}))
    if (photoMap[property.mlsId]) {
      enrichedProperty = { ...property, images: JSON.stringify([photoMap[property.mlsId]]) }
    }
  }

  // Enrich similar listings photos
  const needsPhoto = similar.filter(p => !hasPhoto(p.images) && p.mlsId)
  let similarEnriched = similar
  if (needsPhoto.length > 0) {
    const photoMap: Record<string, string> = await fetchPrimaryPhotos(needsPhoto.map(p => p.mlsId!)).catch(() => ({}))
    similarEnriched = similar.map(p =>
      photoMap[p.mlsId!] ? { ...p, images: JSON.stringify([photoMap[p.mlsId!]]) } : p
    )
  }

  // Always show Catherine as the contact agent — never the listing agent
  const agent = {
    name: aiConfig?.realtorName || "Catherine Gomez",
    phone: aiConfig?.realtorPhone || "",
    email: aiConfig?.realtorEmail || "",
  }

  return <ListingDetailClient property={enrichedProperty} similar={similarEnriched} agent={agent} />
}
