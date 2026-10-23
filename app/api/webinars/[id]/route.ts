export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

/**
 * Edit one webinar after the fact. In practice this is two jobs: pasting in
 * the replay URL once the recording is processed, and cancelling a session.
 *
 * The replay matters more than it looks — it is what turns one Thursday night
 * into a page that keeps bringing registrations months later.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 })
  }

  const data: any = {}
  if (body.replayUrl !== undefined) {
    const url = String(body.replayUrl || "").trim()
    data.replayUrl = url || null
    // Stamped only when a URL is actually set, so the replay page can say when
    // the recording went up rather than when the row was last touched.
    data.replayPostedAt = url ? new Date() : null
  }
  if (body.status !== undefined) {
    const status = String(body.status)
    if (!["SCHEDULED", "LIVE", "ENDED", "CANCELLED"].includes(status)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 })
    }
    data.status = status
  }
  if (body.title !== undefined) data.title = String(body.title).trim()
  if (body.description !== undefined) data.description = String(body.description).trim()
  if (body.projectSlug !== undefined) data.projectSlug = String(body.projectSlug).trim() || null

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada que cambiar" }, { status: 400 })
  }

  const updated = await prisma.webinar.update({
    where: { id: params.id },
    data,
    select: { id: true, slug: true, status: true, replayUrl: true },
  }).catch(() => null)

  if (!updated) return NextResponse.json({ error: "No existe ese webinar" }, { status: 404 })
  return NextResponse.json({ ok: true, webinar: updated })
}

/**
 * The registrant list, with what each person actually did.
 *
 * Sorted by watched time rather than by name: the top of this list is the
 * people worth calling, which is the only reason to open it.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const webinar = await prisma.webinar.findUnique({
    where: { id: params.id },
    select: { id: true, slug: true, title: true, startsAt: true, durationMins: true, status: true },
  })
  if (!webinar) return NextResponse.json({ error: "No existe ese webinar" }, { status: 404 })

  const registrations = await prisma.webinarRegistration.findMany({
    where: { webinarId: params.id },
    orderBy: [{ watchedPct: "desc" }, { createdAt: "asc" }],
    select: {
      id: true, email: true, firstName: true, lastName: true, phone: true,
      source: true, attended: true, watchedPct: true, secondsAttended: true,
      firstJoinedAt: true, lastStage: true, contactId: true, createdAt: true,
    },
  })

  return NextResponse.json({ webinar, registrations })
}
