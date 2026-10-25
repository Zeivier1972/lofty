export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { getStartUrl } from "@/lib/zoom"

/**
 * Open the webinar as the HOST.
 *
 * Catherine kept landing in "waiting for the host to start this meeting",
 * because the only link on the dashboard was the attendee one — the host link
 * was stored and never rendered. It cannot simply be rendered either: Zoom's
 * start_url token dies after roughly two hours, and the meeting is created up
 * to three days ahead, so the stored value is always stale by showtime.
 *
 * This fetches a fresh one at the moment of the click and redirects straight
 * into it. Auth-gated and no-store, because the URL it hands out is, for its
 * short life, the key to starting the meeting as her.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const webinar = await prisma.webinar.findUnique({
    where: { id: params.id },
    select: { zoomMeetingId: true, title: true },
  })
  if (!webinar) return NextResponse.json({ error: "No existe ese webinar" }, { status: 404 })
  if (!webinar.zoomMeetingId) {
    return NextResponse.json(
      { error: "Este webinar todavía no tiene reunión de Zoom. Se crea sola 3 días antes." },
      { status: 409 },
    )
  }

  const res = await getStartUrl(webinar.zoomMeetingId)
  if (!res.ok) {
    console.error(`[webinar/start] ${webinar.title}: ${res.error}`)
    return NextResponse.json({ error: `No se pudo abrir como anfitrión: ${res.error}` }, { status: 502 })
  }

  return NextResponse.redirect(res.startUrl, {
    status: 302,
    headers: { "Cache-Control": "no-store, max-age=0" },
  })
}
