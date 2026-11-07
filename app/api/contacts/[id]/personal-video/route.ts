export const dynamic = "force-dynamic"
export const maxDuration = 60

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { personalVideoUrl, startPersonalVideo } from "@/lib/personal-video"

/** GET: this contact's personal videos. POST { projectHref }: make one (manual, no daily cap). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const rows = await prisma.personalVideo.findMany({
    where: { contactId: params.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, token: true, projectHref: true, status: true, error: true, sentAt: true, views: true, maxPct: true, firstViewedAt: true, createdAt: true },
  })
  return NextResponse.json({ videos: rows.map(r => ({ ...r, url: personalVideoUrl(r.token) })) })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const r = await startPersonalVideo({
    contactId: params.id,
    projectHref: body.projectHref ? String(body.projectHref) : null,
    createdBy: session.user?.name || "Catherine",
    ignoreCap: true,
  })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
  return NextResponse.json({ ok: true, url: personalVideoUrl(r.token) })
}
