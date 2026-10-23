export const dynamic = "force-dynamic"
export const maxDuration = 300

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { sendBulkEmail, wrapEmail } from "@/lib/email"
import { sendSMS, toE164 } from "@/lib/sms"

/**
 * Invite the CRM's own book to a webinar.
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

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.catherinegomezrealtor.com"

const whenMiami = (d: Date) =>
  new Intl.DateTimeFormat("es-US", {
    timeZone: "America/New_York", weekday: "long", day: "numeric", month: "long",
    hour: "numeric", minute: "2-digit", hour12: true,
  }).format(d)

/**
 * Who counts as "my list".
 *
 * Archived contacts are out — they were filed away on purpose. Opt-outs are
 * out. And anyone already signed up for THIS session is out: they do not need
 * an invitation to something they have a confirmation for, and getting one
 * reads as the system not knowing who they are.
 */
async function audience(webinarId: string) {
  const registered = await prisma.webinarRegistration.findMany({
    where: { webinarId, contactId: { not: null } },
    select: { contactId: true },
  })
  const skip = registered.map(r => r.contactId!).filter(Boolean)

  const emailable = await prisma.contact.findMany({
    where: {
      isArchived: false,
      doNotEmail: false,
      email: { not: null },
      ...(skip.length ? { id: { notIn: skip } } : {}),
    },
    select: { id: true, firstName: true, email: true, phone: true, doNotText: true, smsTCPAConsent: true },
  })

  // Texting is its own permission, not a side effect of being on the list.
  // sendSMS enforces this again per message; the count here just has to tell
  // the truth about how many people the SMS half would actually reach.
  const textable = emailable.filter(c => c.phone && !c.doNotText && c.smsTCPAConsent)

  return { emailable, textable, alreadyRegistered: skip.length }
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const webinar = await prisma.webinar.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, startsAt: true, invitedAt: true, invitedCount: true, status: true },
  })
  if (!webinar) return NextResponse.json({ error: "No existe ese webinar" }, { status: 404 })

  const { emailable, textable, alreadyRegistered } = await audience(params.id)

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

  const { emailable, textable } = await audience(params.id)
  const pageUrl = `${BASE}/webinar/${webinar.slug}`
  const when = whenMiami(webinar.startsAt)

  // Stamped BEFORE sending, not after. A few thousand contacts take minutes to
  // work through, and if the request dies partway — timeout, redeploy — a
  // stamp written at the end would never land, so the obvious retry would mail
  // everyone who already got it a second time. Marking first means a failure
  // costs some people their invitation; marking last means it costs everyone
  // else a duplicate. The first is the better way to be wrong.
  await prisma.webinar.update({
    where: { id: params.id },
    data: { invitedAt: new Date(), invitedCount: 0 },
  })

  let emailSent = 0
  let smsSent = 0

  if (wantEmail && emailable.length) {
    // {first_name} is substituted per recipient by sendBulkEmail; wrapEmail adds
    // the signature and the unsubscribe link the bulk route already relies on.
    const html = wrapEmail(
      `<p style="color:#334155;line-height:1.7">Hola {first_name},</p>
       <p style="color:#334155;line-height:1.7">
         <strong style="text-transform:capitalize">${when}</strong> (hora de Miami) voy a hacer algo que
         normalmente solo hago en cita privada: abrir los números completos de un proyecto, en vivo,
         y responder lo que me pregunten.
       </p>
       <p style="color:#334155;line-height:1.7">${webinar.description}</p>
       <p style="text-align:center;margin:28px 0">
         <a href="${pageUrl}" style="background:#0369a1;color:#fff;padding:14px 32px;border-radius:50px;text-decoration:none;font-weight:bold;display:inline-block">Guardar mi lugar</a>
       </p>
       <p style="color:#334155;line-height:1.7">
         Es gratis y es en español. Al final abro preguntas — y esa parte no queda en la grabación,
         así que si tienes una duda puntual, vale la pena en vivo.
       </p>`,
      { agentName: "Catherine Gomez", unsubscribeUrl: "{unsubscribe_url}" },
    )

    const res = await sendBulkEmail(
      emailable.map(c => ({
        to: c.email!,
        vars: { first_name: c.firstName, unsubscribe_url: `${BASE}/api/unsubscribe?id=${c.id}` },
      })),
      { subject: `${webinar.title} — en vivo ${when}`, html },
      50,
      1000,
    ).catch(() => ({ sent: 0, failed: emailable.length }))
    emailSent = res.sent
  }

  if (wantSms && textable.length) {
    // One at a time rather than in parallel: sendSMS carries the do-not-text
    // guard, the content dedupe and the monthly cap, and firing hundreds at
    // once would race those checks against each other.
    for (const c of textable) {
      const sid = await sendSMS(
        toE164(c.phone!),
        `${c.firstName}, soy Catherine. ${when} (hora de Miami) abro en vivo los numeros completos de un proyecto. Gratis y en espanol. Tu lugar: ${pageUrl}`,
        undefined,
        { automated: true, contactId: c.id },
      ).catch(() => null)
      if (sid) smsSent++
    }
  }

  await prisma.webinar.update({
    where: { id: params.id },
    data: { invitedCount: emailSent + smsSent },
  })

  return NextResponse.json({ ok: true, emailSent, smsSent })
}
