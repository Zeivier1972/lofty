import { readdirSync } from "fs"
import { join } from "path"
import Anthropic from "@anthropic-ai/sdk"
import { prisma } from "@/lib/prisma"
import type { ResearchBrief } from "@/lib/content-research"
import type { ContentPlan } from "@/lib/content-plan"
import { projectKnowledgeFor } from "@/lib/project-knowledge"
import { PROJECTS } from "@/lib/projects"
import { fetchVideoByQuery } from "@/lib/pexels-video"
import { randomUUID } from "crypto"
import { ffmpegPath, renderShort, buildCaptions, estimateWords } from "@/lib/local-video"

/**
 * Faceless short-form video (YouTube Shorts / Reels / TikTok) — no AI avatar.
 *
 *   viral brief + day's plan → Claude script (hook, narration, title)
 *   → professional Spanish voiceover (ElevenLabs, or OpenAI TTS fallback)
 *   → Creatomate render: real project renders + real Miami footage,
 *     hook text, word-by-word captions, closing call to action
 *
 * The render is asynchronous; the hourly autopilot check publishes it when
 * Creatomate finishes (status CAPTIONS_PENDING / externalId "cm_<id>").
 */

const anthropic = new Anthropic()
const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.catherinegomezrealtor.com"
export const WEBINAR_SERIES_URL = `${BASE}/webinar/serie/inversion-miami`

/** "Karly" — natural Colombian Spanish, ElevenLabs professional library voice. */
const DEFAULT_ELEVEN_VOICE = "sM4f2a6lmttmqTug8V7W"

/** Creatomate only when explicitly chosen; otherwise we render on our own server. */
function useCreatomate(): boolean {
  return process.env.VIDEO_RENDERER === "creatomate" && !!process.env.CREATOMATE_API_KEY
}

export function facelessConfigured(): { ok: boolean; missing: string[] } {
  const missing: string[] = []
  if (!useCreatomate() && !ffmpegPath()) missing.push("ffmpeg")
  if (!process.env.ELEVENLABS_API_KEY && !process.env.OPENAI_API_KEY) missing.push("ELEVENLABS_API_KEY")
  return { ok: missing.length === 0, missing }
}

// ─── Script ──────────────────────────────────────────────────────────────────

export type ShortScript = { hook: string; voice: string; title: string; cta: string }

export async function writeShortScript(research: ResearchBrief | undefined, plan: ContentPlan): Promise<ShortScript> {
  const book = `${BASE}/book`
  const facts = plan.project ? projectKnowledgeFor(plan.project.href, book) : ""
  const intl = plan.audience === "INTERNACIONAL"
  const cta = `Comenta ${plan.commentKeyword}`

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 900,
    system: `Eres guionista de YouTube Shorts virales de bienes raíces en Miami, en español latino neutro (tú). El video NO muestra a ninguna persona: es narración de voz en off sobre imágenes reales de proyectos y de Miami. Recreas el FORMATO de lo que está funcionando (gancho, estructura, ritmo), nunca copias un video.

Reglas:
- Los primeros 3 segundos deciden todo: abre con un número concreto, una pregunta que duele o una afirmación que sorprende.
- Frases cortas, ritmo rápido, una idea por frase. Nada de saludos ni "en este video".
- Usa SOLO datos reales que te doy. Si no hay dato, no lo inventes. Nunca prometas rentabilidad, ocupación ni valorización.
- PROHIBIDO inventar estadísticas de mercado ("se venden 3 apartamentos por minuto", "el inventario dura 2.3 meses", "precios subieron X%"). El gancho sale de los datos del proyecto (precio, depósito, ubicación, amenidades) o de una pregunta, nunca de una cifra que no te di.
- El título describe exactamente lo que es (un proyecto de condominios en preconstrucción, no "casa en venta").
- En la NARRACIÓN (<voice>) escribe los números como se dicen en voz alta ("cuatrocientos diecinueve mil dólares"), porque lo lee una voz. En el <hook> y el <title> usa cifras ("$419,900", "$42K", "10%"): se leen en pantalla.
- Menciona una vez "Catherine Gomez, Realtor en Miami" (en tercera persona: la voz no es Catherine).
- Termina con: "${cta}" y qué recibe a cambio${intl ? `, y que todos los jueves a las siete de la noche, hora de Colombia, hay un webinar gratis en vivo` : ""}.`,
    messages: [{
      role: "user",
      content: `Tema del día: ${plan.theme}
Audiencia: ${intl ? "inversionistas latinoamericanos (sobre todo colombianos) que compran en Miami desde su país" : "familias en South Florida que buscan casa o townhome nuevo de constructor (Lennar, D.R. Horton…) en Miami-Dade"}
${research ? `Gancho viral de referencia: "${research.viralHook}"\nÁngulo: ${research.engagementAngle}\nPalabras clave: ${research.additionalKeywords.join(", ")}` : ""}
${facts ? `\nDATOS REALES DEL PROYECTO:\n${facts}` : ""}

Devuelve SOLO estas etiquetas:
<hook>texto en pantalla de los primeros 3 segundos, máximo 8 palabras, con una cifra si se puede</hook>
<voice>la narración completa, 80 a 95 palabras (unos 40 segundos). Ni una palabra de relleno.</voice>
<title>título de YouTube Short, máximo 70 caracteres, con la palabra clave principal</title>`,
    }],
  })
  const text = msg.content[0]?.type === "text" ? msg.content[0].text : ""
  const pick = (t: string) => (text.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`, "i"))?.[1] || "").trim()
  const voice = pick("voice")
  if (!voice) throw new Error("script writer returned no narration")
  return {
    hook: pick("hook") || (research?.viralHook ?? "").slice(0, 60),
    voice,
    title: pick("title") || research?.youtubeTitle || "Invertir en Miami",
    cta: `${cta} 👇`,
  }
}

// ─── Voice ───────────────────────────────────────────────────────────────────

/**
 * Narration → { mediaUrl, seconds }. Stored in GeneratedMedia, served publicly.
 *
 * Voice order: ElevenLabs "Karly" (library voice — needs a paid ElevenLabs
 * plan) → OpenAI's Spanish voice → an ElevenLabs default voice (works on the
 * free plan). Upgrading ElevenLabs later switches to Karly with no change here.
 */
export async function synthesizeVoice(text: string): Promise<{ url: string; seconds: number; provider: string; data: Buffer; ext: "mp3" | "wav" }> {
  const errors: string[] = []
  let out: { data: Buffer; mimeType: string; seconds: number; provider: string } | null = null

  const eleven = async (voiceId: string, label: string) => {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true },
      }),
    })
    if (!res.ok) throw new Error(`ElevenLabs ${label} ${res.status}: ${(await res.text()).slice(0, 160)}`)
    const data = Buffer.from(await res.arrayBuffer())
    return { data, mimeType: "audio/mpeg", seconds: (data.length * 8) / 128000, provider: `elevenlabs:${label}` }
  }

  if (process.env.ELEVENLABS_API_KEY) {
    try { out = await eleven(process.env.ELEVENLABS_VOICE_ID || DEFAULT_ELEVEN_VOICE, "karly") }
    catch (e: any) { errors.push(e.message) }
  }

  if (!out && process.env.OPENAI_API_KEY) {
    try {
      const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini-tts",
          voice: "coral",
          input: text,
          instructions: "Locutora profesional latinoamericana, acento colombiano neutro y cálido, ritmo ágil de redes sociales, segura y cercana.",
          response_format: "wav",
        }),
      })
      if (!res.ok) throw new Error(`OpenAI TTS ${res.status}: ${(await res.text()).slice(0, 160)}`)
      const data = Buffer.from(await res.arrayBuffer())
      out = { data, mimeType: "audio/wav", seconds: wavSeconds(data) ?? text.split(/\s+/).length / 2.6, provider: "openai" }
    } catch (e: any) { errors.push(e.message) }
  }

  if (!out && process.env.ELEVENLABS_API_KEY) {
    // ElevenLabs default ("premade") voice — allowed on the free plan.
    try { out = await eleven(process.env.ELEVENLABS_FREE_VOICE_ID || "EXAVITQu4vr4xnSDxMaL", "default") }
    catch (e: any) { errors.push(e.message) }
  }

  if (!out) throw new Error(errors.join(" | ") || "No hay voz configurada (ELEVENLABS_API_KEY)")
  if (errors.length) console.warn(`[faceless-video] voice fallback → ${out.provider}: ${errors.join(" | ")}`)

  // Keep the table small: voiceovers are only needed until the render is done.
  await prisma.generatedMedia.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 14 * 86400000) } } }).catch(() => null)
  const row = await prisma.generatedMedia.create({ data: { mimeType: out.mimeType, data: out.data } })
  const ext = out.mimeType === "audio/wav" ? "wav" : "mp3"
  return { url: `${BASE}/api/media/${row.id}.${ext}`, seconds: Math.max(8, Math.min(90, out.seconds)), provider: out.provider, data: out.data, ext }
}

function wavSeconds(buf: Buffer): number | null {
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF") return null
  const byteRate = buf.readUInt32LE(28)
  // Find the "data" chunk (streamed WAVs may carry a bogus size; use the remainder).
  let off = 12
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4)
    const size = buf.readUInt32LE(off + 4)
    if (id === "data") return byteRate ? (buf.length - off - 8) / byteRate : null
    off += 8 + size
  }
  return null
}

// ─── Visuals ─────────────────────────────────────────────────────────────────

type Visual = { type: "image" | "video"; source: string }

function projectImages(imgPath: string): string[] {
  const dir = imgPath.split("/").slice(1, -1).join("/") // "/domus/x.jpg" → "domus"
  try {
    return readdirSync(join(process.cwd(), "public", dir))
      .filter(f => /\.(jpe?g|png|webp)$/i.test(f))
      .map(f => `${BASE}/${dir}/${f}`)
  } catch {
    return []
  }
}

function shuffle<T>(a: T[]): T[] {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

async function pickVisuals(plan: ContentPlan, count: number): Promise<Visual[]> {
  const intl = plan.audience === "INTERNACIONAL"
  // Real footage first: an aerial Miami opener stops the scroll better than a still.
  const queries = intl
    ? ["Miami aerial skyline", "Brickell Miami", "Miami ocean drone"]
    : ["new homes neighborhood aerial", "Florida suburb houses", "Miami aerial"]
  const clips: Visual[] = []
  for (const q of queries.slice(0, 2)) {
    const url = await fetchVideoByQuery(q, "portrait").catch(() => null)
    if (url) clips.push({ type: "video", source: url })
  }

  let stills: string[] = []
  if (plan.project) stills = projectImages(plan.project.img)
  if (stills.length < count && intl) {
    for (const p of shuffle(PROJECTS.filter(p => p !== plan.project && !p.href.startsWith("/guias")))) {
      stills.push(...projectImages(p.img))
      if (stills.length >= count * 2) break
    }
  }
  const images: Visual[] = shuffle(stills).map(s => ({ type: "image" as const, source: s }))

  // Opener clip, then stills, with the second clip in the middle for rhythm.
  const out: Visual[] = []
  if (clips[0]) out.push(clips[0])
  out.push(...images.slice(0, Math.max(0, count - out.length - (clips[1] ? 1 : 0))))
  if (clips[1]) out.splice(Math.ceil(out.length / 2), 0, clips[1])
  while (out.length < count && clips.length) out.push(clips[out.length % clips.length])
  return out.slice(0, count)
}

// ─── Render ──────────────────────────────────────────────────────────────────

const CAPTION_STYLE = {
  font_family: "Montserrat",
  font_weight: "800",
  fill_color: "#FFFFFF",
  stroke_color: "#000000",
  stroke_width: "0.05em",
  x_alignment: "50%",
}

export async function startFacelessRender(
  research: ResearchBrief | undefined,
  plan: ContentPlan,
  preset?: ShortScript,
): Promise<{ renderId: string; script: ShortScript; provider: string }> {
  const script = preset || await writeShortScript(research, plan)
  const voice = await synthesizeVoice(script.voice)
  const total = Math.round((voice.seconds + 1.2) * 10) / 10
  const slots = Math.max(5, Math.min(9, Math.round(total / 5)))
  const visuals = await pickVisuals(plan, slots)
  if (!visuals.length) throw new Error("no visuals available")

  if (!useCreatomate()) {
    // Our own renderer: runs in the background; status lives in Setting.
    const id = randomUUID().replace(/-/g, "").slice(0, 20)
    await setJob(id, { status: "rendering", startedAt: new Date().toISOString() })
    void (async () => {
      try {
        const words = await wordTimings(voice.data, voice.ext).catch(() => null)
        const captions = buildCaptions(words && words.length ? words : estimateWords(script.voice, voice.seconds))
        const mp4 = await renderShort({
          visuals, audio: voice.data, audioExt: voice.ext, seconds: total,
          hook: script.hook, captions, cta: script.cta,
        })
        const row = await prisma.generatedMedia.create({ data: { mimeType: "video/mp4", data: mp4 } })
        await setJob(id, { status: "succeeded", url: `${BASE}/api/media/${row.id}.mp4` })
        console.log(`[faceless-video] local render ${id} done — ${(mp4.length / 1e6).toFixed(1)} MB, ${total}s`)
      } catch (e: any) {
        console.error(`[faceless-video] local render ${id} failed:`, e)
        await setJob(id, { status: "failed", error: String(e?.message || e).slice(0, 300) })
      }
    })()
    console.log(`[faceless-video] local render ${id} started — ${visuals.length} visuals, ${total}s, voice ${voice.provider}`)
    return { renderId: `ff_${id}`, script, provider: voice.provider }
  }

  const key = process.env.CREATOMATE_API_KEY!
  const each = total / visuals.length

  const elements: any[] = visuals.map((v, i) => ({
    type: v.type,
    track: 1,
    time: Math.round(i * each * 100) / 100,
    duration: Math.round(each * 100) / 100 + 0.05,
    source: v.source,
    fit: "cover",
    ...(v.type === "video" ? { volume: "0%", loop: true } : {}),
    // Slow push-in (Ken Burns) so stills feel like footage.
    x_scale: [{ time: 0, value: "100%" }, { time: Math.round(each * 100) / 100, value: "114%" }],
    y_scale: [{ time: 0, value: "100%" }, { time: Math.round(each * 100) / 100, value: "114%" }],
    animations: i === 0 ? [] : [{ time: "start", duration: 0.35, type: "fade" }],
  }))

  elements.push({ id: "voice", type: "audio", track: 3, time: 0, source: voice.url })

  // Hook: big text for the first 3 seconds.
  elements.push({
    type: "text", track: 4, time: 0, duration: 3.2, text: script.hook.toUpperCase(),
    y: "22%", width: "88%", height: "auto", font_size: "6.5vh", ...CAPTION_STYLE,
    background_color: "rgba(201,168,76,0.92)", background_x_padding: "4%", background_y_padding: "3%",
    fill_color: "#111111", stroke_width: "0",
    animations: [{ time: "start", duration: 0.4, type: "fade" }],
  })

  // Word-by-word captions from the narration.
  elements.push({
    type: "text", track: 5, transcript: true, transcript_source: "voice",
    transcript_effect: "highlight", transcript_placement: "animate",
    transcript_highlight_color: "#FFD700",
    y: "74%", width: "88%", height: "auto", font_size: "6vh", ...CAPTION_STYLE,
  })

  // Closing call to action + brand.
  elements.push({
    type: "text", track: 6, time: Math.max(0, total - 4.5), duration: 4.5, text: script.cta.toUpperCase(),
    y: "22%", width: "88%", height: "auto", font_size: "6vh", ...CAPTION_STYLE,
    background_color: "rgba(17,17,17,0.85)", background_x_padding: "4%", background_y_padding: "3%",
    animations: [{ time: "start", duration: 0.4, type: "fade" }],
  })
  elements.push({
    type: "text", track: 7, time: 0, duration: total, text: "Catherine Gomez Realtor · Miami",
    y: "93%", width: "90%", height: "auto", font_size: "2.4vh", font_family: "Montserrat", font_weight: "600",
    fill_color: "rgba(255,255,255,0.85)", x_alignment: "50%",
  })

  const res = await fetch("https://api.creatomate.com/v1/renders", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      source: { output_format: "mp4", frame_rate: 30, width: 1080, height: 1920, duration: total, elements },
    }),
  })
  const data = await res.json().catch(() => null)
  const render = Array.isArray(data) ? data[0] : data
  if (!res.ok || !render?.id) throw new Error(`Creatomate ${res.status}: ${JSON.stringify(data).slice(0, 300)}`)
  console.log(`[faceless-video] render ${render.id} — ${visuals.length} visuals, ${total}s, voice ${voice.provider}`)
  return { renderId: render.id, script, provider: voice.provider }
}

type Job = { status: string; url?: string; error?: string; startedAt?: string }

async function setJob(id: string, patch: Job) {
  const key = `videojob:${id}`
  const prev = await prisma.setting.findUnique({ where: { key } }).catch(() => null)
  const value = JSON.stringify({ ...(prev ? JSON.parse(prev.value) : {}), ...patch })
  await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } })
}

/** Word-level timings for the captions (OpenAI Whisper); null when unavailable. */
async function wordTimings(audio: Buffer, ext: "mp3" | "wav"): Promise<{ word: string; start: number; end: number }[] | null> {
  if (!process.env.OPENAI_API_KEY) return null
  const form = new FormData()
  form.append("file", new Blob([new Uint8Array(audio)], { type: ext === "wav" ? "audio/wav" : "audio/mpeg" }), `voice.${ext}`)
  form.append("model", "whisper-1")
  form.append("language", "es")
  form.append("response_format", "verbose_json")
  form.append("timestamp_granularities[]", "word")
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: form,
  })
  if (!res.ok) return null
  const d = await res.json()
  return Array.isArray(d.words) ? d.words.map((w: any) => ({ word: String(w.word).trim(), start: Number(w.start), end: Number(w.end) })) : null
}

export async function getRenderStatus(renderId: string): Promise<{ status: string; url?: string; error?: string }> {
  if (renderId.startsWith("ff_")) {
    const row = await prisma.setting.findUnique({ where: { key: `videojob:${renderId.slice(3)}` } }).catch(() => null)
    if (!row) return { status: "failed", error: "render not found" }
    const j: Job = JSON.parse(row.value)
    // A deploy/restart mid-render kills the job; don't leave it "rendering" forever.
    if (j.status === "rendering" && j.startedAt && Date.now() - new Date(j.startedAt).getTime() > 30 * 60000) {
      return { status: "failed", error: "render interrupted (server restarted)" }
    }
    return { status: j.status, url: j.url, error: j.error }
  }
  const key = process.env.CREATOMATE_API_KEY
  if (!key) return { status: "failed", error: "CREATOMATE_API_KEY not set" }
  const res = await fetch(`https://api.creatomate.com/v1/renders/${renderId}`, { headers: { Authorization: `Bearer ${key}` } })
  const data = await res.json().catch(() => null)
  const r = Array.isArray(data) ? data[0] : data
  return { status: r?.status || "unknown", url: r?.url, error: r?.error_message }
}

// ─── Monday script (Catherine can record it herself) ─────────────────────────

export const WEEKLY_SCRIPT_KEY = "weeklyVideoScript"

/** Tuesday's script, written on Monday; the Tuesday render reuses it so both match. */
export async function takeWeeklyScript(): Promise<ShortScript | undefined> {
  const row = await prisma.setting.findUnique({ where: { key: WEEKLY_SCRIPT_KEY } }).catch(() => null)
  if (!row) return undefined
  try {
    const v = JSON.parse(row.value)
    if (Date.now() - new Date(v.createdAt).getTime() > 3 * 86400000) return undefined
    await prisma.setting.delete({ where: { key: WEEKLY_SCRIPT_KEY } }).catch(() => null)
    return v.script as ShortScript
  } catch { return undefined }
}
