export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { recordReplayProgress, handleReplayEngagement } from "@/lib/webinar"

/**
 * Heartbeat from the replay player: "this person is still watching".
 *
 * Public and unauthenticated, because the page it serves is public — gating the
 * replay behind a login would hide it from Google, which is the whole reason it
 * is an open page. The link token is the only credential, and all it can do is
 * add watch time to one registration. The crediting rule lives in
 * recordReplayProgress: time is measured against the gap between beats, not
 * against whatever position the player reports, so a forged body cannot buy
 * more progress than real elapsed time.
 *
 * Always answers 204. A view with no token, an expired link, a token from
 * another webinar — all ordinary, none of them something the visitor should be
 * told about, and none of them worth a console error on a marketing page.
 */
export async function POST(req: Request) {
  let body: any
  try { body = await req.json() } catch { return new NextResponse(null, { status: 204 }) }

  const watchToken = typeof body?.w === "string" ? body.w : ""
  const slug = typeof body?.slug === "string" ? body.slug : ""
  const durationSecs = Number(body?.duration)

  if (!watchToken || !slug) return new NextResponse(null, { status: 204 })

  const progress = await recordReplayProgress({
    watchToken: watchToken.slice(0, 64),
    slug: slug.slice(0, 160),
    durationSecs: Number.isFinite(durationSecs) && durationSecs > 0 ? durationSecs : 0,
  }).catch(e => {
    console.error("[webinar-watch] progress failed:", e)
    return null
  })

  // Awaited rather than fired and forgotten: this happens once per person, the
  // viewer is not waiting on the response body anyway, and letting the request
  // end early would risk losing the hand-off if the container is recycled.
  if (progress?.justCrossed) {
    await handleReplayEngagement(progress.registrationId)
      .catch(e => console.error("[webinar-watch] engagement hand-off failed:", e))
  }

  return new NextResponse(null, { status: 204 })
}
