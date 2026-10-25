import crypto from "crypto"

/**
 * Zoom — creating the weekly webinar meeting and learning who actually showed.
 *
 * This speaks to Zoom MEETINGS, not Zoom Webinars. Meetings is the cheaper
 * product and the one chosen here, which costs two things worth knowing:
 * every attendee can see the participant roster (so investors see each other's
 * names), and the default participant cap is lower. What it does NOT cost is
 * the attendance data, because that comes from webhooks rather than the report
 * API — see `attendance` below.
 *
 * Nothing here throws when the credentials are missing. The webinar can be
 * drafted, published and taking signups before a Zoom app exists; `configured`
 * is false, `createMeeting` returns a reason instead of a meeting, and the
 * landing page shows the session without a join link. That ordering matters
 * because the credentials are created by hand in the Zoom Marketplace and put
 * into Railway, which happens on a person's schedule, not a deploy's.
 *
 * SETUP: a Server-to-Server OAuth app with scopes `meeting:write:admin`,
 * `meeting:read:admin`, `user:read:admin` (add `report:read:admin` only if the
 * plan includes the report API — the backfill below is optional). Then in
 * Railway: ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET,
 * ZOOM_WEBHOOK_SECRET_TOKEN.
 */

const API = "https://api.zoom.us/v2"
const OAUTH = "https://zoom.us/oauth/token"

export function zoomConfigured(): boolean {
  return !!(process.env.ZOOM_ACCOUNT_ID && process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET)
}

/* ----------------------------------------------------------------- auth --- */

/**
 * Server-to-Server OAuth tokens last an hour. Cached in module scope with a
 * safety margin, so a reminder run that creates several meetings does not
 * fetch a token per call. Module scope is per server instance, which is the
 * right lifetime: a restart just fetches a new one.
 */
let cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token

  const accountId = process.env.ZOOM_ACCOUNT_ID
  const clientId = process.env.ZOOM_CLIENT_ID
  const clientSecret = process.env.ZOOM_CLIENT_SECRET
  if (!accountId || !clientId || !clientSecret) {
    throw new Error("Zoom no está configurado — faltan ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET en Railway")
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
  const res = await fetch(`${OAUTH}?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
  })
  const data: any = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) {
    const detail = data.reason || data.error || `HTTP ${res.status}`
    throw new Error(`No se pudo autenticar con Zoom: ${detail}`)
  }

  const ttl = Number(data.expires_in || 3600)
  // 60s of margin so a token never expires mid-request.
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (ttl - 60) * 1000 }
  return cachedToken.token
}

async function zoomFetch(path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; data: any }> {
  const token = await getAccessToken()
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
  })
  // A 204 has no body, and Zoom sends HTML on some gateway errors.
  const text = await res.text()
  let data: any = {}
  if (text) { try { data = JSON.parse(text) } catch { data = { raw: text.slice(0, 400) } } }
  return { ok: res.ok, status: res.status, data }
}

/* -------------------------------------------------------------- meetings --- */

export type CreateMeetingInput = {
  topic: string
  startsAt: Date
  durationMins: number
  /** IANA zone, e.g. "America/New_York". */
  timezone: string
  agenda?: string
}

export type CreateMeetingResult =
  | { ok: true; meetingId: string; joinUrl: string; startUrl: string }
  | { ok: false; error: string }

/**
 * Create the meeting for one webinar session.
 *
 * The settings are the ones that make a Meeting behave like a presentation
 * rather than a conference call: attendees muted and video off on entry, the
 * host able to start before being present, and no waiting room — a waiting
 * room on a 200-person webinar means someone has to admit 200 people by hand.
 * `join_before_host` is false on purpose so nobody is in an empty room talking
 * to each other before Catherine arrives.
 */
export async function createMeeting(input: CreateMeetingInput): Promise<CreateMeetingResult> {
  if (!zoomConfigured()) return { ok: false, error: "Zoom no está configurado todavía" }

  try {
    const { ok, status, data } = await zoomFetch("/users/me/meetings", {
      method: "POST",
      body: JSON.stringify({
        topic: input.topic.slice(0, 200),
        type: 2, // scheduled
        start_time: input.startsAt.toISOString().replace(/\.\d{3}Z$/, "Z"),
        duration: input.durationMins,
        timezone: input.timezone,
        agenda: (input.agenda || "").slice(0, 2000),
        settings: {
          host_video: true,
          participant_video: false,
          mute_upon_entry: true,
          join_before_host: false,
          waiting_room: false,
          approval_type: 2, // no Zoom-side registration: CASAi owns the form
          audio: "both",
          auto_recording: "cloud", // the replay is the evergreen half of this
        },
      }),
    })

    if (!ok || !data?.id) {
      return { ok: false, error: data?.message || `Zoom respondió HTTP ${status}` }
    }
    return {
      ok: true,
      // Zoom's meeting id is a number in JSON and a string everywhere else.
      meetingId: String(data.id),
      joinUrl: data.join_url || "",
      startUrl: data.start_url || "",
    }
  } catch (e: any) {
    return { ok: false, error: String(e.message || e) }
  }
}

/**
 * Delete a meeting. Used to clean up after the self-test in
 * /api/zoom/test — a diagnostic that leaves a stray meeting on Catherine's
 * calendar every time it runs is a diagnostic nobody will run twice.
 */
export async function deleteMeeting(meetingId: string): Promise<{ ok: boolean; error?: string }> {
  if (!zoomConfigured()) return { ok: false, error: "Zoom no está configurado" }
  try {
    const { ok, status, data } = await zoomFetch(`/meetings/${encodeURIComponent(meetingId)}`, { method: "DELETE" })
    // 204 is the success case and carries no body.
    if (!ok && status !== 204) return { ok: false, error: data?.message || `HTTP ${status}` }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: String(e.message || e) }
  }
}

/**
 * A FRESH host start link for a meeting.
 *
 * The `start_url` returned when a meeting is created carries a token that
 * expires after about two hours. A webinar's meeting is created up to three
 * days ahead, so the stored one is always dead by the time it is needed —
 * clicking the attendee link instead is what leaves the host sitting in
 * "waiting for the host to start this meeting", which is the one person who
 * cannot possibly be waiting for themselves.
 *
 * So the link is fetched at the moment it is clicked, never read from the row.
 */
export async function getStartUrl(meetingId: string): Promise<{ ok: true; startUrl: string } | { ok: false; error: string }> {
  if (!zoomConfigured()) return { ok: false, error: "Zoom no está configurado" }
  try {
    const { ok, status, data } = await zoomFetch(`/meetings/${encodeURIComponent(meetingId)}`)
    if (!ok) return { ok: false, error: data?.message || `HTTP ${status}` }
    if (!data?.start_url) return { ok: false, error: "Zoom no devolvió start_url" }
    return { ok: true, startUrl: data.start_url }
  } catch (e: any) {
    return { ok: false, error: String(e.message || e) }
  }
}

/** The account user the meetings are created under. Proves the read scope. */
export async function getMe(): Promise<{ ok: boolean; email?: string; accountId?: string; type?: number; error?: string }> {
  if (!zoomConfigured()) return { ok: false, error: "Zoom no está configurado" }
  try {
    const { ok, status, data } = await zoomFetch("/users/me")
    if (!ok) return { ok: false, error: data?.message || `HTTP ${status}` }
    return { ok: true, email: data?.email, accountId: data?.account_id, type: data?.type }
  } catch (e: any) {
    return { ok: false, error: String(e.message || e) }
  }
}

/* ------------------------------------------------------------ attendance --- */

export type ZoomParticipant = {
  email: string | null
  name: string | null
  joinedAt: Date | null
  leftAt: Date | null
  seconds: number
}

/**
 * Participant report for a finished meeting — the OVERNIGHT BACKFILL, not the
 * primary source.
 *
 * Attendance is collected live from the `meeting.participant_joined` and
 * `meeting.participant_left` webhooks, for two reasons. One, the report API's
 * plan requirement is genuinely unclear (Zoom's own docs say Pro in one place
 * and the developer forum says Business in another), and designing the feature
 * around an endpoint that might 400 on this account is a bad bet. Two, webhooks
 * handle the case the report handles badly anyway: someone who drops and
 * rejoins produces several join/leave pairs, and summing them is right where
 * last-minus-first is wrong.
 *
 * So this exists to repair gaps — a webhook delivery Zoom retried into a
 * deploy, say — and returns an empty list rather than throwing when the plan
 * does not include it.
 */
export async function getMeetingParticipants(meetingId: string): Promise<ZoomParticipant[]> {
  if (!zoomConfigured()) return []

  const out: ZoomParticipant[] = []
  let nextPageToken = ""
  let guard = 0

  try {
    do {
      const qs = new URLSearchParams({ page_size: "300" })
      if (nextPageToken) qs.set("next_page_token", nextPageToken)
      const { ok, status, data } = await zoomFetch(
        `/report/meetings/${encodeURIComponent(meetingId)}/participants?${qs.toString()}`,
      )

      if (!ok) {
        // 400/403 here is the plan not including reports. Say so once, clearly,
        // and let the webhook data stand on its own.
        console.warn(
          `[zoom] participant report unavailable for ${meetingId} (HTTP ${status}: ${data?.message || "?"}). ` +
          `Attendance stays as collected from webhooks.`,
        )
        return out
      }

      for (const p of (data.participants || []) as any[]) {
        const joinedAt = p.join_time ? new Date(p.join_time) : null
        const leftAt = p.leave_time ? new Date(p.leave_time) : null
        out.push({
          email: (p.user_email || "").trim().toLowerCase() || null,
          name: p.name || null,
          joinedAt,
          leftAt,
          seconds: Number(p.duration || 0),
        })
      }
      nextPageToken = data.next_page_token || ""
    } while (nextPageToken && guard++ < 20)
  } catch (e) {
    console.warn(`[zoom] participant report threw for ${meetingId}:`, e)
  }
  return out
}

/** Share of the scheduled run actually watched, clamped to 0-100. */
export function watchedPercent(secondsAttended: number, durationMins: number): number {
  const total = Math.max(1, durationMins) * 60
  return Math.max(0, Math.min(100, Math.round((secondsAttended / total) * 100)))
}

/* --------------------------------------------------------------- webhook --- */

export function zoomWebhookConfigured(): boolean {
  return !!process.env.ZOOM_WEBHOOK_SECRET_TOKEN
}

/**
 * Verify a webhook delivery.
 *
 * Zoom signs `v0:<timestamp>:<raw body>` with the secret token and sends it as
 * `x-zm-signature: v0=<hex>`. The RAW body has to be hashed — re-serialising
 * the parsed JSON changes key order and whitespace and the signature stops
 * matching, which is the usual way this gets written wrong.
 *
 * Compared with timingSafeEqual: a plain `===` on a signature leaks how much
 * of a forged one was right.
 */
export function verifyZoomWebhook(rawBody: string, signature: string | null, timestamp: string | null): boolean {
  const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN
  if (!secret || !signature || !timestamp) return false

  const expected = `v0=${crypto.createHmac("sha256", secret).update(`v0:${timestamp}:${rawBody}`).digest("hex")}`
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

/**
 * Answer Zoom's `endpoint.url_validation` challenge. Zoom sends a plainToken
 * when the webhook URL is saved and expects it back alongside its HMAC; until
 * that round-trip succeeds Zoom will not deliver any events at all.
 */
export function zoomUrlValidationResponse(plainToken: string): { plainToken: string; encryptedToken: string } | null {
  const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN
  if (!secret) return null
  return {
    plainToken,
    encryptedToken: crypto.createHmac("sha256", secret).update(plainToken).digest("hex"),
  }
}
