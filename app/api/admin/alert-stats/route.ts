export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const header = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "")
  const param = new URL(req.url).searchParams.get("secret")
  return header === secret || param === secret
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tz = "America/New_York"
  const now = new Date()

  // Start of today ET (midnight)
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: tz }) // "YYYY-MM-DD"
  const todayStart = new Date(`${todayStr}T00:00:00-05:00`)

  // Last 7 days
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [todayAlerts, last7dAlerts, todayEmails, last7dEmails, todayEmailsDelivered] = await Promise.all([
    prisma.activity.count({
      where: { type: "PROPERTY_ALERT_SENT", createdAt: { gte: todayStart } },
    }),
    prisma.activity.count({
      where: { type: "PROPERTY_ALERT_SENT", createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.activity.count({
      where: { type: "EMAIL_SENT", createdAt: { gte: todayStart } },
    }),
    prisma.activity.count({
      where: { type: "EMAIL_SENT", createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.email.count({
      where: { direction: "OUTBOUND", createdAt: { gte: todayStart } },
    }),
  ])

  // Recent alert activity with contact info
  const recentAlerts = await prisma.activity.findMany({
    where: { type: "PROPERTY_ALERT_SENT", createdAt: { gte: sevenDaysAgo } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      createdAt: true,
      metadata: true,
      contact: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  })

  // Group today's alerts by contact
  const todayByContact: Record<string, { name: string; email: string | null; count: number }> = {}
  for (const a of recentAlerts) {
    const d = new Date(a.createdAt)
    if (d < todayStart) continue
    const cid = a.contact?.id || "unknown"
    if (!todayByContact[cid]) {
      todayByContact[cid] = {
        name: `${a.contact?.firstName || ""} ${a.contact?.lastName || ""}`.trim() || "Unknown",
        email: a.contact?.email || null,
        count: 0,
      }
    }
    todayByContact[cid].count++
  }

  return NextResponse.json({
    asOf: now.toLocaleString("en-US", { timeZone: tz, dateStyle: "full", timeStyle: "short" }),
    propertyAlerts: {
      today: todayAlerts,
      last7Days: last7dAlerts,
    },
    emailsSent: {
      today: todayEmails,
      last7Days: last7dEmails,
      deliveredToday: todayEmailsDelivered,
      dailyLimit: Number(process.env.EMAIL_DAILY_LIMIT || 100),
    },
    todayByContact: Object.values(todayByContact).sort((a, b) => b.count - a.count),
    recentAlerts: recentAlerts.slice(0, 20).map(a => ({
      contact: `${a.contact?.firstName || ""} ${a.contact?.lastName || ""}`.trim() || "Unknown",
      email: a.contact?.email || null,
      title: a.title,
      sentAt: a.createdAt,
    })),
  })
}
