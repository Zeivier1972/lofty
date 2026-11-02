export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * The fixed link of a weekly webinar: /webinar/serie/<series>.
 *
 * Goes to whichever session is next (or on air right now), so the link in the
 * Instagram bio, a pinned post or an ad never needs changing week to week.
 * Between sessions with nothing scheduled, the latest recording; failing that,
 * the latest session's page.
 */
const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.catherinegomezrealtor.com"

export async function GET(req: Request, { params }: { params: { series: string } }) {
  const series = decodeURIComponent(params.series || "").toLowerCase()
  const qs = new URL(req.url).search // keep utm_* for attribution
  const now = Date.now()

  const next = await prisma.webinar.findFirst({
    where: {
      series,
      status: { in: ["SCHEDULED", "LIVE"] },
      // A session stays "next" until it has been on for an hour.
      startsAt: { gt: new Date(now - 60 * 60000) },
    },
    orderBy: { startsAt: "asc" },
    select: { slug: true },
  })
  if (next) return NextResponse.redirect(`${BASE}/webinar/${next.slug}${qs}`, 302)

  const replay = await prisma.webinar.findFirst({
    where: { series, replayUrl: { not: null }, status: { not: "CANCELLED" } },
    orderBy: { startsAt: "desc" },
    select: { slug: true },
  })
  if (replay) return NextResponse.redirect(`${BASE}/webinar/${replay.slug}/replay${qs}`, 302)

  const last = await prisma.webinar.findFirst({
    where: { series },
    orderBy: { startsAt: "desc" },
    select: { slug: true },
  })
  if (last) return NextResponse.redirect(`${BASE}/webinar/${last.slug}${qs}`, 302)

  return NextResponse.redirect(`${BASE}/proyectos`, 302)
}
