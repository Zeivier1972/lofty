export const dynamic = "force-dynamic"
export const maxDuration = 300

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { inviteAudience, parseTags, sendWebinarInvite } from "@/lib/webinar-invite"

/**
 * Invite the CRM's own book to a webinar — everyone, or only some tags.
 *
 * This is the cheapest seat-filler there is and the one most likely to be
 * skipped, because doing it by hand means going to Contacts, selecting people,
 * writing the mail and pasting the right link — and the link is the step that
 * goes wrong. Here the webinar supplies its own URL, so the invitation cannot
 * point at the wrong session.
 *
 * Deliberately two calls: GET answers "who would this reach", POST sends. A
 * blast to the whole book is not undoable, so the number is on screen before
 * anything leaves.
 */

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const webinar = await prisma.webinar.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, startsAt: true, invitedAt: true, invitedCount: true, status: true },
  })
  if (!webinar) return NextResponse.json({ error: "No existe ese webinar" }, { status: 404 })

  const tags = parseTags(new URL(req.url).searchParams.get("tags") || "[]")
  const { emailable, textable, alreadyRegistered } = await inviteAudience(params.id, tags)

  return NextResponse.json({
    webinar,
    emailCount: emailable.length,
    smsCount: textable.length,
    alreadyRegistered,
  })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { body = {} }
  const wantEmail = body?.email !== false
  const wantSms = body?.sms === true
  const force = body?.force === true

  const webinar = await prisma.webinar.findUnique({
    where: { id: params.id },
    select: {
      id: true, slug: true, title: true, description: true, startsAt: true,
      status: true, invitedAt: true, invitedCount: true,
    },
  })
  if (!webinar) return NextResponse.json({ error: "No existe ese webinar" }, { status: 404 })
  if (webinar.status === "CANCELLED") {
    return NextResponse.json({ error: "Ese webinar está cancelado." }, { status: 400 })
  }
  if (webinar.startsAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Ese webinar ya pasó. Para la grabación usa el campo de abajo." }, { status: 400 })
  }
  // Re-sending is a real choice, not a double click.
  if (webinar.invitedAt && !force) {
    return NextResponse.json(
      { error: "Ya invitaste a tu lista a este webinar.", invitedAt: webinar.invitedAt, invitedCount: webinar.invitedCount },
      { status: 409 },
    )
  }

  const tags = parseTags(body?.tags)
  const { emailSent, smsSent } = await sendWebinarInvite(params.id, { email: wantEmail, sms: wantSms, tags })
  return NextResponse.json({ ok: true, emailSent, smsSent })
}
