export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600000)

  // Hot leads: high score, recent activity
  const hotLeads = await prisma.contact.findMany({
    where: { isArchived: false, leadScore: { gte: 40 } },
    orderBy: { leadScore: "desc" },
    take: 10,
    select: {
      id: true, firstName: true, lastName: true, phone: true, email: true,
      leadScore: true, status: true, lastContacted: true,
      buyerBudgetMax: true, buyerLocation: true,
      sellerAddress: true, sellerEstimatedValue: true,
      propertyViews: { where: { createdAt: { gte: sevenDaysAgo } }, select: { id: true } },
      appointments: { where: { startTime: { gte: now } }, select: { id: true, startTime: true } },
    },
  })

  // Contacts that engaged recently but were never followed up on
  const needsFollowUp = await prisma.contact.findMany({
    where: {
      isArchived: false,
      leadScore: { gte: 20 },
      OR: [
        { lastContacted: null },
        { lastContacted: { lte: new Date(now.getTime() - 14 * 24 * 3600000) } },
      ],
      propertyViews: { some: { createdAt: { gte: sevenDaysAgo } } },
    },
    orderBy: { leadScore: "desc" },
    take: 5,
    select: {
      id: true, firstName: true, lastName: true, phone: true,
      leadScore: true, lastContacted: true,
      propertyViews: { where: { createdAt: { gte: sevenDaysAgo } }, select: { id: true } },
    },
  })

  // Contacts with upcoming birthdays (next 7 days)
  const birthdays: any[] = []
  const allWithBirthday = await prisma.contact.findMany({
    where: { birthday: { not: null }, isArchived: false },
    select: { id: true, firstName: true, lastName: true, birthday: true },
  })
  for (const c of allWithBirthday) {
    if (!c.birthday) continue
    const bDate = new Date(c.birthday)
    const thisYear = new Date(now.getFullYear(), bDate.getMonth(), bDate.getDate())
    const daysUntil = Math.round((thisYear.getTime() - now.getTime()) / (24 * 3600000))
    if (daysUntil >= 0 && daysUntil <= 7) birthdays.push({ ...c, daysUntil })
  }

  // Likely sellers: homeClosedAt > 3 years ago, no active transaction
  const likelySellers = await prisma.contact.findMany({
    where: {
      isArchived: false,
      homeClosedAt: { not: null, lte: new Date(now.getFullYear() - 3, now.getMonth(), now.getDate()) },
      transactions: { none: { status: { in: ["ACTIVE_LISTING", "UNDER_CONTRACT"] } } },
    },
    take: 5,
    select: { id: true, firstName: true, lastName: true, homeClosedAt: true, sellerEstimatedValue: true },
  })

  // New leads not yet contacted
  const newUncontacted = await prisma.contact.count({
    where: {
      isArchived: false,
      createdAt: { gte: thirtyDaysAgo },
      lastContacted: null,
      status: "LEAD",
    },
  })

  return NextResponse.json({
    hotLeads: hotLeads.map(c => ({
      ...c,
      recentViews: c.propertyViews.length,
      hasAppointment: c.appointments.length > 0,
      nextAppointment: c.appointments[0]?.startTime || null,
      propertyViews: undefined,
      appointments: undefined,
    })),
    needsFollowUp: needsFollowUp.map(c => ({
      ...c,
      recentViews: c.propertyViews.length,
      propertyViews: undefined,
    })),
    birthdays: birthdays.sort((a, b) => a.daysUntil - b.daysUntil),
    likelySellers,
    newUncontacted,
  })
}
