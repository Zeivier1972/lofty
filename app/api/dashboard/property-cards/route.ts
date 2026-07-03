export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    // Get top properties by saves (last 30 days)
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // Get properties with their saves + views counts
    const [saves, views] = await Promise.all([
      prisma.propertySave.findMany({
        where: { isActive: true, createdAt: { gte: cutoff } },
        include: {
          property: { select: { id: true, address: true, city: true, state: true, price: true, bedrooms: true, bathrooms: true, sqft: true, images: true, mlsId: true } },
          contact: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.propertyView.findMany({
        where: { contactId: { not: null }, createdAt: { gte: cutoff } },
        include: {
          property: { select: { id: true, address: true, city: true, state: true, price: true, bedrooms: true, bathrooms: true, sqft: true, images: true, mlsId: true } },
          contact: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ])

    // Group by property, collecting unique buyers
    const propMap = new Map<string, {
      property: any
      buyers: Map<string, { id: string; name: string; phone: string | null; email: string | null; action: string; at: Date }>
      totalSaves: number
      totalViews: number
    }>()

    for (const s of saves) {
      const pid = s.property.id
      if (!propMap.has(pid)) propMap.set(pid, { property: s.property, buyers: new Map(), totalSaves: 0, totalViews: 0 })
      const entry = propMap.get(pid)!
      entry.totalSaves++
      if (s.contact) {
        const cid = s.contact.id
        if (!entry.buyers.has(cid)) {
          entry.buyers.set(cid, {
            id: cid,
            name: `${s.contact.firstName} ${s.contact.lastName || ""}`.trim(),
            phone: s.contact.phone,
            email: s.contact.email,
            action: "saved",
            at: s.createdAt,
          })
        }
      }
    }

    for (const v of views) {
      const pid = v.property.id
      if (!propMap.has(pid)) propMap.set(pid, { property: v.property, buyers: new Map(), totalSaves: 0, totalViews: 0 })
      const entry = propMap.get(pid)!
      entry.totalViews++
      if (v.contact) {
        const cid = v.contact.id
        if (!entry.buyers.has(cid)) {
          entry.buyers.set(cid, {
            id: cid,
            name: `${v.contact.firstName} ${v.contact.lastName || ""}`.trim(),
            phone: v.contact.phone,
            email: v.contact.email,
            action: "viewed",
            at: v.createdAt,
          })
        }
      }
    }

    // Sort by total interactions (saves weighted 2x)
    const cards = Array.from(propMap.values())
      .map(e => ({
        ...e.property,
        totalSaves: e.totalSaves,
        totalViews: e.totalViews,
        buyers: Array.from(e.buyers.values()),
      }))
      .sort((a, b) => (b.totalSaves * 2 + b.totalViews) - (a.totalSaves * 2 + a.totalViews))
      .slice(0, 12)

    return NextResponse.json({ ok: true, cards })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
