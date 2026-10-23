export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { createMeeting, zoomConfigured } from "@/lib/zoom"
import { findProject } from "@/lib/investment-projects"

/**
 * Webinars, from the dashboard. Authenticated — the public side is
 * /api/webinar/register, which is a different route on purpose.
 *
 * A webinar used to be a row somebody had to insert by hand, which made the
 * whole system unusable without database access.
 */

/** "Invertir en Millenia Park" → "invertir-en-millenia-park". */
function slugify(raw: string): string {
  return (raw || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const webinars = await prisma.webinar.findMany({
    orderBy: { startsAt: "desc" },
    take: 100,
    select: {
      id: true, slug: true, series: true, title: true, description: true,
      startsAt: true, durationMins: true, timezone: true, status: true,
      zoomJoinUrl: true, zoomMeetingId: true, replayUrl: true, projectSlug: true, coverImageUrl: true,
      _count: { select: { registrations: true } },
    },
  })

  // Attendance per webinar in one pass, rather than a query each.
  const attended = await prisma.webinarRegistration.groupBy({
    by: ["webinarId"],
    where: { attended: true },
    _count: { _all: true },
  })
  const attendedBy = new Map(attended.map(a => [a.webinarId, a._count._all]))

  return NextResponse.json({
    zoomConfigured: zoomConfigured(),
    webinars: webinars.map(w => ({
      ...w,
      registrations: w._count.registrations,
      attendedCount: attendedBy.get(w.id) ?? 0,
    })),
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 })
  }

  const title = String(body.title || "").trim()
  const description = String(body.description || "").trim()
  const startsAtRaw = String(body.startsAt || "")
  if (!title) return NextResponse.json({ error: "Falta el título" }, { status: 400 })
  if (!description) return NextResponse.json({ error: "Falta la descripción — es lo que se ve en la página y en Google" }, { status: 400 })

  const startsAt = new Date(startsAtRaw)
  if (isNaN(startsAt.getTime())) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 })

  const wantedProject = String(body.projectSlug || "").trim()
  const project = findProject(wantedProject)
  if (wantedProject && !project) {
    return NextResponse.json(
      { error: `No existe el proyecto "${wantedProject}". Elígelo de la lista.` },
      { status: 400 },
    )
  }

  // A slug has to be unique and it is what gets shared, so collisions are
  // resolved by suffixing rather than by refusing the whole create — two
  // sessions of the same series legitimately share a title.
  const base = slugify(body.slug || title) || "webinar"
  let slug = base
  for (let i = 2; i < 50; i++) {
    const taken = await prisma.webinar.findUnique({ where: { slug }, select: { id: true } })
    if (!taken) break
    slug = `${base}-${i}`
  }

  const webinar = await prisma.webinar.create({
    data: {
      slug,
      title,
      description,
      startsAt,
      series: body.series ? String(body.series).trim() : null,
      // Validated rather than trusted: an unknown slug used to be rendered
      // into a link that 404'd for every visitor to the public page.
      projectSlug: project?.slug ?? null,
      durationMins: Math.max(10, Math.min(480, Number(body.durationMins) || 60)),
      timezone: String(body.timezone || "America/New_York"),
      language: String(body.language || "es"),
      // Falls back to the project's own social card, so a webinar about a
      // project never goes out as a bare link with no picture.
      coverImageUrl: String(body.coverImageUrl || "").trim() || project?.og || null,
    },
  })

  // Create the Zoom meeting now when it is close enough that the cron would
  // not get to it first — the cron only looks three days ahead, so a webinar
  // scheduled for tomorrow would otherwise sit without a link.
  let zoomNote: string | null = null
  if (zoomConfigured() && startsAt.getTime() - Date.now() < 3 * 86400000) {
    const res = await createMeeting({
      topic: title,
      startsAt,
      durationMins: webinar.durationMins,
      timezone: webinar.timezone,
      agenda: description,
    })
    if (res.ok) {
      await prisma.webinar.update({
        where: { id: webinar.id },
        data: { zoomMeetingId: res.meetingId, zoomJoinUrl: res.joinUrl, zoomStartUrl: res.startUrl },
      })
      zoomNote = "Reunión de Zoom creada."
    } else {
      zoomNote = `El webinar quedó creado, pero Zoom falló: ${res.error}`
    }
  } else if (!zoomConfigured()) {
    zoomNote = "Zoom no está configurado — el webinar toma registros, pero sin enlace."
  } else {
    zoomNote = "La reunión de Zoom se crea sola 3 días antes."
  }

  return NextResponse.json({ ok: true, id: webinar.id, slug: webinar.slug, zoomNote })
}
