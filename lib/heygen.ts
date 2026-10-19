/**
 * HeyGen client — one place that knows which API version we speak.
 *
 * HeyGen retires v1 and v2 on 2026-11-01. This CRM had 14 call sites spread
 * across eight files, all on the retiring versions, and two of them are the
 * daily social autopilot: generate a video, then poll until it is ready to
 * publish. If those go dark the video pipeline stops without an error anyone
 * would notice.
 *
 * `HEYGEN_API_VERSION` switches between "v3" (default) and "v2". The default is
 * the destination on purpose: v2 still works until 31 October, so the only way
 * to find out whether v3 renders the same video is to run it while there is
 * still time to react. Setting the variable to "v2" reverts in one deploy.
 */

const BASE = "https://api.heygen.com"

export type HeyGenVersion = "v2" | "v3"

export function heygenVersion(): HeyGenVersion {
  return process.env.HEYGEN_API_VERSION === "v2" ? "v2" : "v3"
}

function headers(apiKey: string) {
  return { "X-Api-Key": apiKey, "Content-Type": "application/json" }
}

/* --------------------------------------------------------------- scenes --- */

export type SceneBackground =
  | { type: "image"; url: string }
  | { type: "color"; value: string }
  | { type: "video"; url: string }

export type HeyGenScene =
  /** The avatar is on screen, speaking, over a background. */
  | { kind: "avatar"; avatarId: string; script: string; voiceId?: string; background?: SceneBackground }
  /**
   * B-roll: no avatar on screen, a stock clip fills the frame and the voice
   * narrates over it.
   */
  | { kind: "broll"; videoUrl: string; script: string; voiceId?: string }

export type CreateVideoOptions = {
  scenes: HeyGenScene[]
  /** v2 took pixels; v3 takes an aspect ratio plus a resolution tier. */
  width?: number
  height?: number
  caption?: boolean
  title?: string
  callbackUrl?: string
}

/* ------------------------------------------------------------ v3 bodies --- */

const asset = (url: string) => ({ type: "url" as const, url })

function v3Background(bg?: SceneBackground) {
  if (!bg) return undefined
  if (bg.type === "color") {
    // v3 requires a 6-digit hex; anything else is rejected outright, so a value
    // that does not match is dropped rather than failing the whole render.
    return /^#[0-9a-fA-F]{6}$/.test(bg.value) ? { type: "color", color: bg.value } : undefined
  }
  if (bg.type === "image") return { type: "image", source: asset(bg.url) }
  return { type: "video", source: asset(bg.url) }
}

/** v2 sent `dimension: {width, height}`; v3 wants an aspect ratio and a tier. */
export function toAspectRatio(width?: number, height?: number): { aspect_ratio: string; resolution: string } {
  const w = width ?? 1080
  const h = height ?? 1920
  const r = w / h
  const near = (target: number) => Math.abs(r - target) < 0.02
  const aspect = near(16 / 9) ? "16:9"
    : near(9 / 16) ? "9:16"
    : near(4 / 5) ? "4:5"
    : near(5 / 4) ? "5:4"
    : near(1) ? "1:1"
    : "9:16"
  // The tier is the short edge: 1080x1920 is a 1080p portrait video.
  const shortEdge = Math.min(w, h)
  const resolution = shortEdge >= 2160 ? "4k" : shortEdge >= 1080 ? "1080p" : "720p"
  return { aspect_ratio: aspect, resolution }
}

/**
 * Build the v3 `type: "studio"` body.
 *
 * Note for anyone comparing with the old payload: a b-roll scene used to be an
 * entry with a `voice` and a video `background` but NO `character`. In v3 that
 * is not an avatar scene without an avatar — it is a `video` scene carrying a
 * voiceover, and `playback.mode` is where the old `play_style: "fit_to_scene"`
 * went. The schemas are `additionalProperties: false`, so leftover v2 keys
 * (`dimension`, `avatar_style`, `voice.type`) are rejected, not ignored.
 */
export function buildV3StudioBody(opts: CreateVideoOptions): Record<string, unknown> {
  const { aspect_ratio, resolution } = toAspectRatio(opts.width, opts.height)

  const scenes = opts.scenes.map(s => {
    if (s.kind === "avatar") {
      const input: Record<string, unknown> = {
        type: "avatar",
        avatar_id: s.avatarId,
        script: s.script,
      }
      // v3 falls back to the avatar's own default voice when voice_id is
      // omitted, which v2 never did.
      if (s.voiceId) input.voice_id = s.voiceId
      const bg = v3Background(s.background)
      if (bg) input.background = bg
      return { type: "avatar_video", input }
    }
    const scene: Record<string, unknown> = {
      type: "video",
      source: asset(s.videoUrl),
      script: s.script,
      playback: { mode: "fit_to_scene" },
    }
    if (s.voiceId) scene.voice_id = s.voiceId
    return scene
  })

  const body: Record<string, unknown> = { type: "studio", scenes, aspect_ratio, resolution }
  if (opts.title) body.title = opts.title
  if (opts.callbackUrl) body.callback_url = opts.callbackUrl
  // v2's `caption: true` burned captions into the render. In v3 a sidecar .srt
  // always comes back and `style` is what burns them in, so the old behaviour
  // needs the style set.
  if (opts.caption) body.caption = { file_format: "srt", style: "default" }
  return body
}

/** The v2 body, kept so HEYGEN_API_VERSION=v2 is a real escape hatch. */
export function buildV2Body(opts: CreateVideoOptions, talkingPhotoIds: Set<string>): Record<string, unknown> {
  const video_inputs = opts.scenes.map(s => {
    if (s.kind === "avatar") {
      const character = talkingPhotoIds.has(s.avatarId)
        ? { type: "talking_photo", talking_photo_id: s.avatarId }
        : { type: "avatar", avatar_id: s.avatarId, avatar_style: "normal" }
      return {
        character,
        voice: { type: "text", input_text: s.script, voice_id: s.voiceId },
        background: s.background?.type === "image"
          ? { type: "image", url: s.background.url }
          : s.background?.type === "video"
            ? { type: "video", url: s.background.url, play_style: "fit_to_scene" }
            : s.background
              ? { type: "color", value: s.background.value }
              : undefined,
      }
    }
    return {
      voice: { type: "text", input_text: s.script, voice_id: s.voiceId },
      background: { type: "video", url: s.videoUrl, play_style: "fit_to_scene" },
    }
  })
  return {
    video_inputs,
    dimension: { width: opts.width ?? 1080, height: opts.height ?? 1920 },
    caption: !!opts.caption,
  }
}

/* ---------------------------------------------------------------- calls --- */

export type CreateVideoResult = { videoId: string | null; version: HeyGenVersion; error?: string }

export async function createVideo(
  opts: CreateVideoOptions,
  talkingPhotoIds: Set<string> = new Set(),
): Promise<CreateVideoResult> {
  const apiKey = process.env.HEYGEN_API_KEY
  const version = heygenVersion()
  if (!apiKey) return { videoId: null, version, error: "HEYGEN_API_KEY not configured" }

  const url = version === "v3" ? `${BASE}/v3/videos` : `${BASE}/v2/video/generate`
  const body = version === "v3" ? buildV3StudioBody(opts) : buildV2Body(opts, talkingPhotoIds)

  try {
    const res = await fetch(url, { method: "POST", headers: headers(apiKey), body: JSON.stringify(body) })
    const data: any = await res.json().catch(() => ({}))
    logLegacyWarning(url, data)

    const videoId = data?.data?.video_id ?? null
    if (!videoId) {
      // v3 errors are {error:{code,message,param}}; v2 used a different shape.
      const err = data?.error?.message || data?.message || `HTTP ${res.status}`
      console.error(`[heygen] create failed (${version}, HTTP ${res.status}): ${err}`, JSON.stringify(data).slice(0, 600))
      return { videoId: null, version, error: String(err) }
    }
    console.log(`[heygen] created video ${videoId} via ${version} (${opts.scenes.length} scenes)`)
    return { videoId, version }
  } catch (e) {
    console.error(`[heygen] create threw (${version}):`, e)
    return { videoId: null, version, error: String(e) }
  }
}

export type VideoStatus = { status: string | null; videoUrl: string | null; raw: any }

/**
 * Poll one video.
 *
 * The v3 response shape could not be verified — this container cannot reach
 * HeyGen's docs or API — so the fields are read defensively across the names
 * v1 used and the ones v3 plausibly uses, and the first unrecognised payload is
 * logged in full. If the autopilot ever stops publishing finished videos, that
 * log line is where the real field names will be.
 */
export async function getVideoStatus(videoId: string): Promise<VideoStatus> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) return { status: null, videoUrl: null, raw: null }
  const version = heygenVersion()

  const url = version === "v3"
    ? `${BASE}/v3/videos/${encodeURIComponent(videoId)}`
    : `${BASE}/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`

  const res = await fetch(url, { headers: { "X-Api-Key": apiKey } })
  const data: any = await res.json().catch(() => ({}))
  logLegacyWarning(url, data)

  const d = data?.data ?? data
  const status: string | null = d?.status ?? d?.state ?? null
  const videoUrl: string | null = d?.video_url ?? d?.url ?? d?.output?.video_url ?? d?.output_url ?? null

  if (version === "v3" && !status) {
    console.error(
      `[heygen] v3 status response not understood for ${videoId} — ` +
      `set HEYGEN_API_VERSION=v2 to revert while this is fixed. Payload: ${JSON.stringify(data).slice(0, 800)}`,
    )
  }
  return { status, videoUrl, raw: data }
}

/** `completed` is v1's wording; v3 may say `done`/`success`. Accept all. */
export function isFinished(status: string | null): boolean {
  if (!status) return false
  return ["completed", "complete", "done", "success", "succeeded", "ready"].includes(status.toLowerCase())
}

export function isFailed(status: string | null): boolean {
  if (!status) return false
  return ["failed", "error", "cancelled", "canceled"].includes(status.toLowerCase())
}

/**
 * Every v1/v2 response now carries a `warning` object naming its v3
 * replacement. Logging it turns a day of real traffic into the authoritative
 * migration list — including any call site a grep missed.
 */
export function logLegacyWarning(url: string, data: any): void {
  const w = data?.warning
  if (!w) return
  console.warn(`[heygen DEPRECATED] ${url} → ${w.v3_endpoint ?? "?"} (sunset ${w.sunset_date ?? "?"}): ${w.message ?? ""}`)
}
