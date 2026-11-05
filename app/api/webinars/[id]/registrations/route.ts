export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

/**
 * Who registered for a webinar — the list behind the "N registrados" count on
 * /webinars. Newest first, with what each person did (attended live, watched
 * the recording) and a link to their contact.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await auth())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rows = await prisma.webinarRegistration.findMany({
    where: { webinarId: params.id },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true, firstName: true, lastName: true, email: true, phone: true, source: true,
      contactId: true, createdAt: true, attended: true, watchedPct: true, replayPct: true, lastStage: true,
    },
  })
  return NextResponse.json({ registrations: rows })
}
