export const dynamic = "force-dynamic"

// Who is behind a property's views/saves — the leads driving the numbers on
// the "Propiedades populares" dashboard card.
//   GET /api/dashboard/property-leads?propertyId=...
// Returns each lead with their view/save counts and last-activity time,
// most engaged first.

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const propertyId = new URL(req.url).searchParams.get("propertyId")
  if (!propertyId) return NextResponse.json({ error: "propertyId required" }, { status: 400 })

  const [views, saves] = await Promise.all([
    prisma.propertyView.findMany({
      where: { propertyId, contactId: { not: null } },
      select: { contactId: true, createdAt: true },
    }),
    prisma.propertySave.findMany({
      where: { propertyId, isActive: true },
      select: { contactId: true, createdAt: true },
    }),
  ])

  const byContact = new Map<string, { views: number; saves: number; lastAt: Date }>()
  const bump = (contactId: string | null, field: "views" | "saves", at: Date) => {
    if (!contactId) return
    const e = byContact.get(contactId) || { views: 0, saves: 0, lastAt: at }
    e[field]++
    if (at > e.lastAt) e.lastAt = at
    byContact.set(contactId, e)
  }
  for (const v of views) bump(v.contactId, "views", v.createdAt)
  for (const s of saves) bump(s.contactId, "saves", s.createdAt)

  const ids = Array.from(byContact.keys())
  const contacts = ids.length
    ? await prisma.contact.findMany({
        where: { id: { in: ids } },
        select: {
          id: true, firstName: true, lastName: true, phone: true, email: true,
          pipelineLeads: { select: { stage: { select: { name: true } } }, take: 1, orderBy: { updatedAt: "desc" } },
        },
      })
    : []

  const leads = ids
    .map(id => {
      const c = contacts.find((x: { id: string }) => x.id === id)
      const e = byContact.get(id)!
      return {
        id,
        name: c ? `${c.firstName} ${c.lastName || ""}`.trim() : "Lead",
        phone: c?.phone || null,
        email: c?.email || null,
        stage: c?.pipelineLeads?.[0]?.stage?.name || null,
        views: e.views,
        saves: e.saves,
        total: e.views + e.saves,
        lastAt: e.lastAt,
      }
    })
    .sort((a, b) => b.total - a.total)

  return NextResponse.json({ ok: true, leads })
}
