export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { subMonths, startOfMonth, endOfMonth } from "date-fns"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const now = new Date()
  const days30ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const days7ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // Last 6 months for monthly chart
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, 5 - i)
    return {
      start: startOfMonth(d),
      end: endOfMonth(d),
      label: d.toLocaleString("default", { month: "short" }),
    }
  })

  const [smsOutbound, emailActivities, emailOutbound] = await Promise.all([
    prisma.sMSMessage.findMany({
      where: { direction: "OUTBOUND", createdAt: { gte: months[0].start } },
      select: { createdAt: true },
    }),
    // Activity EMAIL_SENT covers automated cron sends
    prisma.activity.findMany({
      where: { type: "EMAIL_SENT", createdAt: { gte: months[0].start } },
      select: { createdAt: true },
    }),
    // Email model covers manual CRM sends + new automated sends
    prisma.email.findMany({
      where: { direction: "OUTBOUND", createdAt: { gte: months[0].start } },
      select: { createdAt: true },
    }),
  ])

  function groupByMonth(dates: Date[]) {
    return months.map((m) => ({
      month: m.label,
      count: dates.filter((d) => d >= m.start && d <= m.end).length,
    }))
  }

  function groupByDay(dates: Date[], since: Date) {
    const map = new Map<string, number>()
    for (const d of dates) {
      if (d < since) continue
      const key = d.toISOString().slice(0, 10)
      map.set(key, (map.get(key) || 0) + 1)
    }
    const result = []
    for (let i = 29; i >= 0; i--) {
      const dt = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const key = dt.toISOString().slice(0, 10)
      result.push({ date: key, count: map.get(key) || 0 })
    }
    return result
  }

  // Combine email sources
  // Activity EMAIL_SENT covers automated sends; Email model covers manual + new automated
  const allEmailDates = [
    ...emailActivities.map((e) => e.createdAt),
    ...emailOutbound.map((e) => e.createdAt),
  ].sort((a, b) => a.getTime() - b.getTime())

  const smsDates = smsOutbound.map((s) => s.createdAt)

  const smsMonthly = groupByMonth(smsDates)
  const emailMonthly = groupByMonth(allEmailDates)
  const smsDaily = groupByDay(smsDates, days30ago)
  const emailDaily = groupByDay(allEmailDates, days30ago)

  const smsLast30 = smsDates.filter((d) => d >= days30ago).length
  const emailLast30 = allEmailDates.filter((d) => d >= days30ago).length
  const smsLast7 = smsDates.filter((d) => d >= days7ago).length
  const emailLast7 = allEmailDates.filter((d) => d >= days7ago).length

  // Cost estimates: Twilio SMS ~$0.0075, Resend ~$0.001 after first 3k
  const smsCost = smsLast30 * 0.0075
  const emailCost = Math.max(0, emailLast30 - 3000) * 0.001

  return NextResponse.json({
    ok: true,
    smsMonthly,
    emailMonthly,
    smsDaily,
    emailDaily,
    totals: { smsLast30, emailLast30, smsLast7, emailLast7, smsCost, emailCost },
  })
}
