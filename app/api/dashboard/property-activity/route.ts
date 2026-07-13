export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Hot buyers + hot properties: contacts/properties saved or viewed >= 3 times.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Lead views (identified contacts) and anonymous web views are DIFFERENT
  // signals — mixing them made properties look "hot" with zero known leads.
  const [savesByContact, viewsByContact, savesByProp, viewsByProp, anonByProp] = await Promise.all([
    prisma.propertySave.groupBy({ by: ["contactId"], where: { isActive: true }, _count: { _all: true } }),
    prisma.propertyView.groupBy({ by: ["contactId"], where: { contactId: { not: null } }, _count: { _all: true } }),
    prisma.propertySave.groupBy({ by: ["propertyId"], where: { isActive: true }, _count: { _all: true } }),
    prisma.propertyView.groupBy({ by: ["propertyId"], where: { contactId: { not: null } }, _count: { _all: true } }),
    prisma.propertyView.groupBy({ by: ["propertyId"], where: { contactId: null }, _count: { _all: true } }),
  ])

  const merge = (rows: any[], key: string, field: "saves" | "views", map: Map<string, { saves: number; views: number }>) => {
    for (const r of rows) {
      const id = r[key]
      if (!id) continue
      const e = map.get(id) || { saves: 0, views: 0 }
      e[field] += r._count._all
      map.set(id, e)
    }
  }

  const cMap = new Map<string, { saves: number; views: number }>()
  merge(savesByContact, "contactId", "saves", cMap)
  merge(viewsByContact, "contactId", "views", cMap)
  const hotC = Array.from(cMap.entries()).filter(([, c]) => c.saves + c.views >= 3).sort((a, b) => b[1].saves + b[1].views - (a[1].saves + a[1].views)).slice(0, 15)
  const contacts = hotC.length ? await prisma.contact.findMany({ where: { id: { in: hotC.map(([id]) => id) } }, select: { id: true, firstName: true, lastName: true, phone: true, email: true } }) : []
  const hotContacts = hotC.map(([id, c]) => {
    const ct = contacts.find(x => x.id === id)
    return { id, name: ct ? `${ct.firstName} ${ct.lastName || ""}`.trim() : "Lead", phone: ct?.phone || null, email: ct?.email || null, saves: c.saves, views: c.views, total: c.saves + c.views }
  })

  const pMap = new Map<string, { saves: number; views: number }>()
  merge(savesByProp, "propertyId", "saves", pMap)
  merge(viewsByProp, "propertyId", "views", pMap)
  const anonMap = new Map<string, number>()
  for (const r of anonByProp as any[]) { if (r.propertyId) anonMap.set(r.propertyId, r._count._all) }

  // Include properties hot by EITHER signal, but rank lead activity far above
  // anonymous web traffic (a save/lead-view is worth ~10 anonymous views).
  const allPropIds = new Set([...Array.from(pMap.keys()), ...Array.from(anonMap.keys())])
  const scored = Array.from(allPropIds).map(id => {
    const c = pMap.get(id) || { saves: 0, views: 0 }
    const anon = anonMap.get(id) || 0
    return { id, saves: c.saves, views: c.views, anonViews: anon, score: (c.saves + c.views) * 10 + anon }
  })
  const hotP = scored.filter(p => p.saves + p.views + p.anonViews >= 3).sort((a, b) => b.score - a.score).slice(0, 15)
  const props = hotP.length ? await prisma.property.findMany({ where: { id: { in: hotP.map(p => p.id) } }, select: { id: true, address: true, city: true, price: true, mlsId: true } }) : []
  const hotProperties = hotP.map(h => {
    const p = props.find((x: { id: string }) => x.id === h.id)
    return { id: h.id, mlsId: p?.mlsId ?? null, address: p ? `${p.address}, ${p.city}` : "Propiedad", price: p?.price ?? null, saves: h.saves, views: h.views, anonViews: h.anonViews, total: h.saves + h.views }
  })

  return NextResponse.json({ ok: true, hotContacts, hotProperties })
}
