import { prisma } from "@/lib/prisma"
import { createVideo, getVideoStatus, isFinished, isFailed } from "@/lib/heygen"
import { getHeyGenAvatar } from "@/lib/social-autopilot"
import { wordTimings } from "@/lib/faceless-video"
import { extractAudio } from "@/lib/local-video"
import { refreshAccessToken, uploadVideoToYouTube } from "@/lib/youtube-upload"
import { TOUR_VIDEO } from "@/app/parkside/colombia/data"
import { PILOT_SCENES, PILOT_META, pilotDescription } from "@/lib/pilot-plan"
import { editPilot, renderThumbnail, chaptersFrom, type SceneTiming } from "@/lib/pilot-render"

/**
 * The 16:9 YouTube pilot, step by step, with Catherine approving each step:
 *
 *   plan ─(Aprobar plan)→ avatar (HeyGen renders the A-roll, ~10–20 min)
 *        → editing (our server cuts in the B-roll) → review (she watches it in
 *        the CRM) ─(Subir oculto)→ uploaded (unlisted on YouTube)
 *        ─(Publicar)→ public
 *
 * Nothing reaches YouTube without her click, and nothing becomes public
 * without a second one. State lives in one Setting row.
 */

const KEY = "youtube_pilot"
const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.catherinegomezrealtor.com"

export type PilotStage = "plan" | "avatar" | "editing" | "review" | "uploaded" | "public" | "failed"
export type PilotState = {
  stage: PilotStage
  updatedAt: string
  heygenId?: string
  avatarUrl?: string
  finalUrl?: string
  thumbUrl?: string
  timings?: SceneTiming[]
  chapters?: { at: number; title: string }[]
  shots?: { scene: string; kind: string; seconds: number }[]
  duration?: number
  youtubeId?: string
  thumbnailSet?: boolean
  error?: string
}

export async function getPilot(): Promise<PilotState> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } }).catch(() => null)
  if (!row) return { stage: "plan", updatedAt: new Date().toISOString() }
  try { return JSON.parse(row.value) } catch { return { stage: "plan", updatedAt: new Date().toISOString() } }
}

async function save(patch: Partial<PilotState>, replace = false): Promise<PilotState> {
  const prev = replace ? {} : await getPilot()
  const next = { ...prev, ...patch, updatedAt: new Date().toISOString() } as PilotState
  const value = JSON.stringify(next)
  await prisma.setting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } })
  return next
}

export const resetPilot = () => save({ stage: "plan" }, true)

/** Step 1: HeyGen renders Catherine saying the whole plan, 16:9 1080p. */
export async function startPilot(): Promise<PilotState> {
  const cur = await getPilot()
  if (cur.stage === "avatar" || cur.stage === "editing") throw new Error("El piloto ya se está creando")
  const who = await getHeyGenAvatar(new Date().getDay())
  if (!who) throw new Error("No pude leer el avatar o la voz de HeyGen")
  const r = await createVideo({
    scenes: PILOT_SCENES.map(s => ({ kind: "avatar" as const, avatarId: who.avatarId, voiceId: who.voiceId, script: s.narration })),
    width: 1920,
    height: 1080,
    caption: false,
    title: `Piloto YouTube — ${PILOT_META.topic}`,
  })
  if (!r.videoId) throw new Error(`HeyGen: ${r.error || "sin video_id"}`)
  console.log(`[pilot] HeyGen A-roll ${r.videoId} (avatar ${who.avatarId}, voice ${who.voiceId})`)
  return save({ stage: "avatar", heygenId: r.videoId }, true)
}

/** Called by the panel while it is open: moves the pilot along. */
export async function refreshPilot(): Promise<PilotState> {
  const s = await getPilot()
  if (s.stage === "avatar" && s.heygenId) {
    const st = await getVideoStatus(s.heygenId)
    if (isFinished(st.status) && st.videoUrl) {
      const next = await save({ stage: "editing", avatarUrl: st.videoUrl })
      void runEdit(st.videoUrl)
      return next
    }
    if (isFailed(st.status)) return save({ stage: "failed", error: `HeyGen: ${JSON.stringify(st.raw?.data?.failure_message || st.raw?.data?.error || st.status).slice(0, 200)}` })
  }
  // A deploy mid-edit kills the job; let her start the edit again.
  if (s.stage === "editing" && Date.now() - new Date(s.updatedAt).getTime() > 40 * 60000) {
    return save({ stage: "failed", error: "La edición se interrumpió (el servidor se reinició). Pulsa «Editar de nuevo»." })
  }
  return s
}

/** Re-run only the edit (same HeyGen render) — e.g. after an interrupted job. */
export async function reEditPilot(): Promise<PilotState> {
  const s = await getPilot()
  if (!s.avatarUrl && s.heygenId) {
    const st = await getVideoStatus(s.heygenId)
    if (st.videoUrl) s.avatarUrl = st.videoUrl
  }
  if (!s.avatarUrl) throw new Error("No hay video de HeyGen para editar")
  const next = await save({ stage: "editing", avatarUrl: s.avatarUrl, error: undefined })
  void runEdit(s.avatarUrl)
  return next
}

async function download(url: string, ms = 180000): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms) })
  if (!res.ok) throw new Error(`descarga ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

async function runEdit(avatarUrl: string) {
  try {
    const avatar = await download(avatarUrl)
    const tour = await download(TOUR_VIDEO.src).catch(e => { console.warn("[pilot] 3D tour download failed:", e); return null })
    const words = await wordTimings(await extractAudio(avatar), "mp3")
    if (!words?.length) throw new Error("Sin tiempos de palabras (¿OPENAI_API_KEY?)")
    const r = await editPilot({ avatar, tour, words })
    const vid = await prisma.generatedMedia.create({ data: { mimeType: "video/mp4", data: r.video } })
    const th = await prisma.generatedMedia.create({ data: { mimeType: "image/jpeg", data: await renderThumbnail() } })
    await save({
      stage: "review",
      finalUrl: `${BASE}/api/media/${vid.id}.mp4`,
      thumbUrl: `${BASE}/api/media/${th.id}.jpg`,
      timings: r.timings,
      chapters: chaptersFrom(PILOT_SCENES, r.timings, r.duration),
      shots: r.shots,
      duration: r.duration,
      error: undefined,
    })
    console.log(`[pilot] edit done — ${r.duration.toFixed(1)}s, ${r.shots.length} shots, ${(r.video.length / 1e6).toFixed(1)} MB`)
  } catch (e: any) {
    console.error("[pilot] edit failed:", e)
    await save({ stage: "failed", error: String(e?.message || e).slice(0, 300) })
  }
}

async function youtubeAccount() {
  const acc = await prisma.socialAccount.findFirst({ where: { platform: "YOUTUBE", isConnected: true } })
  if (!acc?.refreshToken) throw new Error("YouTube no está conectado (Social → Cuentas)")
  return acc
}

/** Step 2 (her click): upload UNLISTED with title, description, chapters, tags, thumbnail. */
export async function uploadPilot(): Promise<PilotState> {
  const s = await getPilot()
  if (s.stage !== "review" || !s.finalUrl) throw new Error("Primero tiene que estar listo el video")
  const acc = await youtubeAccount()
  const link = await uploadVideoToYouTube({
    videoUrl: s.finalUrl,
    title: PILOT_META.title,
    description: pilotDescription(s.chapters || []),
    tags: PILOT_META.tags,
    refreshToken: acc.refreshToken!,
    privacyStatus: "unlisted",
  })
  const youtubeId = /([A-Za-z0-9_-]{11})$/.exec(link)?.[1]
  if (!youtubeId) throw new Error(`YouTube no devolvió el ID (${link})`)

  // Custom thumbnails need a verified channel; if it fails she uploads it by hand.
  let thumbnailSet = false
  if (s.thumbUrl) {
    try {
      const token = await refreshAccessToken(acc.refreshToken!)
      const img = await download(s.thumbUrl, 30000)
      const res = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${youtubeId}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/jpeg" }, body: new Uint8Array(img),
      })
      thumbnailSet = res.ok
      if (!res.ok) console.warn(`[pilot] thumbnail ${res.status}: ${(await res.text()).slice(0, 300)}`)
    } catch (e) { console.warn("[pilot] thumbnail failed:", e) }
  }
  return save({ stage: "uploaded", youtubeId, thumbnailSet })
}

/** Step 3 (her second click): make it public. */
export async function publishPilot(): Promise<PilotState> {
  const s = await getPilot()
  if (s.stage !== "uploaded" || !s.youtubeId) throw new Error("Primero súbelo como oculto")
  const acc = await youtubeAccount()
  const token = await refreshAccessToken(acc.refreshToken!)
  const res = await fetch("https://www.googleapis.com/youtube/v3/videos?part=status", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id: s.youtubeId, status: { privacyStatus: "public", selfDeclaredMadeForKids: false } }),
  })
  if (!res.ok) throw new Error(`YouTube ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return save({ stage: "public" })
}
