export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyZoomWebhook, zoomUrlValidationResponse, zoomWebhookConfigured } from "@/lib/zoom"
import { recordJoin, recordLeave } from "@/lib/webinar"

/**
 * Zoom webhooks — the primary source of webinar attendance.
 *
 * Attendance comes from here rather than from the participant report API: that
 * endpoint's plan requirement is unclear (Zoom's docs say Pro, their forum says
 * Business) and it would 400 silently on the wrong plan, whereas webhooks work
 * on any plan that can host a meeting. It also handles the awkward case
 * correctly — someone who drops and rejoins sends several join/leave pairs, and
 * summing them is right where last-minus-first is wrong.
 *
 * Subscribe this URL in the Zoom app to: `meeting.participant_joined`,
 * `meeting.participant_left`, `meeting.started`, `meeting.ended`.
 *
 * Note on the body: the raw text is read ONCE and hashed before parsing. Zoom
 * signs the exact bytes, so re-serialising the parsed object changes key order
 * and whitespace and the signature stops matching.
 */
export async function POST(req: Request) {
  const raw = await req.text()

  let body: any
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 })
  }

  // Zoom's one-time challenge when the webhook URL is saved. Until this
  // round-trip succeeds Zoom delivers no events at all, so it is handled before
  // the signature check — the challenge is itself signed, but answering it is
  // the only way to get to a state where anything else arrives.
  if (body?.event === "endpoint.url_validation" && body?.payload?.plainToken) {
    const answer = zoomUrlValidationResponse(String(body.payload.plainToken))
    if (!answer) {
      console.error("[zoom/webhook] url_validation arrived but ZOOM_WEBHOOK_SECRET_TOKEN is not set in Railway")
      return NextResponse.json({ error: "webhook secret not configured" }, { status: 500 })
    }
    return NextResponse.json(answer)
  }

  if (!zoomWebhookConfigured()) {
    console.error("[zoom/webhook] event received but ZOOM_WEBHOOK_SECRET_TOKEN is not set — rejecting unverifiable delivery")
    return NextResponse.json({ error: "not configured" }, { status: 503 })
  }

  if (!verifyZoomWebhook(raw, req.headers.get("x-zm-signature"), req.headers.get("x-zm-request-timestamp"))) {
    // Anyone can POST here, and an unverified body could mark arbitrary people
    // as having attended — which would route them as hot leads.
    return NextResponse.json({ error: "bad signature" }, { status: 401 })
  }

  const event: string = body?.event || ""
  const obj = body?.payload?.object || {}
  const meetingId = obj.id != null ? String(obj.id) : ""
  if (!meetingId) return NextResponse.json({ ok: true, ignored: "no meeting id" })

  try {
    switch (event) {
      case "meeting.participant_joined":
      case "meeting.participant_left": {
        const p = obj.participant || {}
        // `user_email` is only populated for signed-in participants; an
        // unmatched attendee is normal and gets picked up by the report
        // backfill, so this is not an error path.
        const email: string | null = (p.user_email || "").trim().toLowerCase() || null
        const stampRaw = event.endsWith("joined") ? p.join_time : p.leave_time
        const at = stampRaw ? new Date(stampRaw) : new Date()

        const matched = event.endsWith("joined")
          ? await recordJoin({ zoomMeetingId: meetingId, email, at })
          : await recordLeave({ zoomMeetingId: meetingId, email, at })

        return NextResponse.json({ ok: true, event, matched })
      }

      case "meeting.started":
      case "meeting.ended": {
        const status = event === "meeting.started" ? "LIVE" : "ENDED"
        const { count } = await prisma.webinar.updateMany({
          where: { zoomMeetingId: meetingId },
          data: { status },
        })
        return NextResponse.json({ ok: true, event, updated: count })
      }

      default:
        return NextResponse.json({ ok: true, ignored: event })
    }
  } catch (e: any) {
    // A 500 makes Zoom retry, which is what we want for a transient DB error.
    console.error(`[zoom/webhook] ${event} failed for meeting ${meetingId}:`, e)
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
