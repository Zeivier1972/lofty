import { spawn } from "child_process"
import { existsSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

/**
 * Renders a 1080×1920 Short on our own server with ffmpeg — no Creatomate,
 * no HeyGen. Stills get a slow push-in, clips are cropped to vertical, the
 * voiceover is laid on top, and the hook, word captions, closing call to
 * action and brand line are burned in.
 */

export type LocalVisual = { type: "image" | "video"; source: string }
export type Caption = { start: number; end: number; text: string }

const W = 1080
const H = 1920
const FPS = 30

export function ffmpegPath(): string | null {
  if (process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const p = require("ffmpeg-static") as string | null
    if (p && existsSync(p)) return p
  } catch { /* not installed */ }
  return null
}

function run(bin: string, args: string[], timeoutMs = 10 * 60000): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] })
    let err = ""
    p.stderr.on("data", d => { err = (err + d.toString()).slice(-4000) })
    const t = setTimeout(() => { p.kill("SIGKILL"); reject(new Error("ffmpeg timeout")) }, timeoutMs)
    p.on("close", code => { clearTimeout(t); code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}: ${err.slice(-600)}`)) })
    p.on("error", e => { clearTimeout(t); reject(e) })
  })
}

const FONT_BLACK = join(process.cwd(), "public/fonts/Inter-Black.otf")
const FONT_SEMI = join(process.cwd(), "public/fonts/Inter-SemiBold.otf")

/** Break text into lines of at most `max` characters (drawtext does not wrap). */
export function wrap(text: string, max: number): string {
  const lines: string[] = []
  let cur = ""
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if (cur && (cur + " " + w).length > max) { lines.push(cur); cur = w } else cur = cur ? `${cur} ${w}` : w
  }
  if (cur) lines.push(cur)
  return lines.join("\n")
}

/** Group word timings (or plain text) into short on-screen captions. */
export function buildCaptions(words: { word: string; start: number; end: number }[]): Caption[] {
  const caps: Caption[] = []
  let buf: typeof words = []
  const flush = () => {
    if (!buf.length) return
    caps.push({ start: buf[0].start, end: buf[buf.length - 1].end, text: buf.map(w => w.word).join(" ") })
    buf = []
  }
  for (const w of words) {
    buf.push(w)
    const text = buf.map(x => x.word).join(" ")
    if (buf.length >= 4 || text.length >= 20 || /[.,;:!?]$/.test(w.word)) flush()
  }
  flush()
  // Close gaps so a caption stays until the next one starts.
  for (let i = 0; i < caps.length - 1; i++) caps[i].end = Math.max(caps[i].end, caps[i + 1].start)
  return caps
}

/** Without word timings: spread the narration over the audio by length. */
export function estimateWords(text: string, seconds: number): { word: string; start: number; end: number }[] {
  const words = text.split(/\s+/).filter(Boolean)
  const total = words.reduce((a, w) => a + w.length + 1, 0)
  const span = Math.max(1, seconds - 0.4)
  let t = 0.2
  return words.map(w => {
    const d = ((w.length + 1) / total) * span
    const r = { word: w, start: t, end: t + d }
    t += d
    return r
  })
}

async function materialize(src: string, dir: string, i: number): Promise<string> {
  // Our own renders are on disk already: /domus/x.jpg → public/domus/x.jpg.
  const site = process.env.NEXT_PUBLIC_APP_URL || "https://www.catherinegomezrealtor.com"
  for (const prefix of [site, "https://www.catherinegomezrealtor.com"]) {
    if (src.startsWith(prefix)) {
      const p = join(process.cwd(), "public", decodeURIComponent(src.slice(prefix.length).split("?")[0]))
      if (existsSync(p)) return p
    }
  }
  if (existsSync(src)) return src
  const res = await fetch(src, { signal: AbortSignal.timeout(60000) })
  if (!res.ok) throw new Error(`download ${res.status} ${src.slice(0, 80)}`)
  const ext = /\.(mp4|mov|webm)(\?|$)/i.test(src) || (res.headers.get("content-type") || "").startsWith("video") ? "mp4" : "jpg"
  const p = join(dir, `in${i}.${ext}`)
  writeFileSync(p, Buffer.from(await res.arrayBuffer()))
  return p
}

export async function renderShort(opts: {
  visuals: LocalVisual[]
  audio: Buffer
  audioExt: "mp3" | "wav"
  seconds: number
  hook: string
  captions: Caption[]
  cta: string
  brand?: string
}): Promise<Buffer> {
  const ff = ffmpegPath()
  if (!ff) throw new Error("ffmpeg not available")
  const dir = mkdtempSync(join(tmpdir(), "short-"))
  try {
    const total = opts.seconds
    const n = opts.visuals.length
    const each = total / n
    const frames = Math.ceil(each * FPS) + 2

    // 1. One clip per visual, same size/fps/codec so they concatenate cleanly.
    const parts: string[] = []
    for (let i = 0; i < n; i++) {
      const v = opts.visuals[i]
      let src: string
      try { src = await materialize(v.source, dir, i) } catch { continue }
      const out = join(dir, `p${i}.mp4`)
      const fadeIn = i === 0 ? "" : ",fade=t=in:st=0:d=0.3"
      const common = ["-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-r", String(FPS)]
      try {
        if (v.type === "video") {
          await run(ff, ["-y", "-stream_loop", "-1", "-t", each.toFixed(2), "-i", src,
            "-vf", `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},setsar=1${fadeIn}`,
            "-t", each.toFixed(2), ...common, out])
        } else {
          // Slow push-in (Ken Burns). Upscale first so the zoom stays smooth.
          await run(ff, ["-y", "-i", src,
            "-vf", `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},` +
              `zoompan=z='min(zoom+0.0007,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS},setsar=1${fadeIn}`,
            "-frames:v", String(frames), ...common, out])
        }
        parts.push(out)
      } catch (e) {
        console.warn(`[local-video] skipped visual ${i}: ${(e as Error).message.slice(0, 200)}`)
      }
    }
    if (!parts.length) throw new Error("no visual could be prepared")

    // If some visuals failed, stretch the rest to cover the narration.
    const list = join(dir, "list.txt")
    const loops = Math.ceil(n / parts.length)
    const seq = Array.from({ length: loops }, () => parts).flat().slice(0, n)
    writeFileSync(list, seq.map(p => `file '${p}'`).join("\n"))
    const base = join(dir, "base.mp4")
    await run(ff, ["-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", base])

    // 2. Text layers. Every text goes through a file, so quotes, colons and
    //    accents never need escaping.
    // The font has no emoji: drop them (and other pictographs) rather than draw boxes.
    const clean = (t: string) => t.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF\uFE0F\u200D]/g, "").replace(/\s+/g, " ").trim()
    const tf = (name: string, text: string) => { const p = join(dir, name); writeFileSync(p, text.split("\n").map(clean).join("\n"), "utf8"); return p }
    const filters: string[] = []
    const hookFile = tf("hook.txt", wrap(opts.hook.toUpperCase(), 16))
    filters.push(`drawtext=fontfile='${FONT_BLACK}':textfile='${hookFile}':fontsize=82:fontcolor=0x111111:line_spacing=10:` +
      `box=1:boxcolor=0xC9A84C@0.95:boxborderw=28:x=(w-text_w)/2:y=h*0.17:enable='between(t,0,3.3)'`)
    opts.captions.forEach((c, i) => {
      if (c.end <= 3.3 && c.start < 3.3) return // the hook owns the first seconds
      const f = tf(`c${i}.txt`, wrap(c.text.toUpperCase(), 18))
      filters.push(`drawtext=fontfile='${FONT_BLACK}':textfile='${f}':fontsize=70:fontcolor=white:line_spacing=8:` +
        `borderw=6:bordercolor=black:x=(w-text_w)/2:y=h*0.70:enable='between(t,${Math.max(c.start, 3.3).toFixed(2)},${c.end.toFixed(2)})'`)
    })
    const ctaFile = tf("cta.txt", wrap(opts.cta.toUpperCase(), 18))
    filters.push(`drawtext=fontfile='${FONT_BLACK}':textfile='${ctaFile}':fontsize=76:fontcolor=white:line_spacing=10:` +
      `box=1:boxcolor=0x111111@0.85:boxborderw=28:x=(w-text_w)/2:y=h*0.17:enable='gte(t,${Math.max(0, total - 4.5).toFixed(2)})'`)
    const brandFile = tf("brand.txt", opts.brand || "Catherine Gomez Realtor · Miami")
    filters.push(`drawtext=fontfile='${FONT_SEMI}':textfile='${brandFile}':fontsize=34:fontcolor=white@0.9:` +
      `borderw=2:bordercolor=black@0.6:x=(w-text_w)/2:y=h*0.93`)
    const filterFile = tf("filters.txt", filters.join(",\n"))

    const audio = join(dir, `voice.${opts.audioExt}`)
    writeFileSync(audio, opts.audio)
    const out = join(dir, "short.mp4")
    await run(ff, ["-y", "-i", base, "-i", audio, "-filter_script:v", filterFile,
      "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k", "-t", total.toFixed(2), "-movflags", "+faststart", out])
    return readFileSync(out)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
