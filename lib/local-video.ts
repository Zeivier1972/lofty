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

const FONT_TITLE = join(process.cwd(), "public/fonts/Anton-Regular.ttf")
const FONT_SERIF = join(process.cwd(), "public/fonts/DMSerifDisplay-Regular.ttf")
const FONT_SERIF_TEXT = join(process.cwd(), "public/fonts/DMSerifText-Regular.ttf")
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
  /** Giant condensed word across the top (e.g. BRICKELL), like a magazine masthead. */
  title?: string
  /** Bottom label (project or brand name). */
  label?: string
  /** Background music, ducked under the voice. */
  music?: { data: Buffer; ext: string }
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
    const shadow = "shadowcolor=black@0.55:shadowx=3:shadowy=3"
    // Masthead: one giant condensed word across the top, the whole video.
    const title = (opts.title || "MIAMI").toUpperCase()
    const titleSize = Math.min(330, Math.floor((W * 0.94) / Math.max(1, title.length * 0.47)))
    filters.push(`drawtext=fontfile='${FONT_TITLE}':textfile='${tf("title.txt", title)}':fontsize=${titleSize}:fontcolor=white@0.82:${shadow}:` +
      `x=(w-text_w)/2:y=h*0.035`)
    // Hook: elegant serif, first seconds, under the masthead.
    filters.push(`drawtext=fontfile='${FONT_SERIF}':textfile='${tf("hook.txt", wrap(opts.hook, 20))}':fontsize=86:fontcolor=white:line_spacing=12:${shadow}:` +
      `x=(w-text_w)/2:y=h*0.25:enable='between(t,0,3.3)'`)
    // Captions: serif, sentence case, soft shadow — no heavy outline.
    opts.captions.forEach((c, i) => {
      if (c.end <= 3.3 && c.start < 3.3) return
      const f = tf(`c${i}.txt`, wrap(c.text, 24))
      filters.push(`drawtext=fontfile='${FONT_SERIF_TEXT}':textfile='${f}':fontsize=66:fontcolor=white:line_spacing=10:${shadow}:` +
        `x=(w-text_w)/2:y=h*0.70:enable='between(t,${Math.max(c.start, 3.3).toFixed(2)},${c.end.toFixed(2)})'`)
    })
    // Closing call to action.
    filters.push(`drawtext=fontfile='${FONT_TITLE}':textfile='${tf("cta.txt", wrap(opts.cta.toUpperCase(), 16))}':fontsize=110:fontcolor=white:line_spacing=12:` +
      `box=1:boxcolor=black@0.45:boxborderw=30:x=(w-text_w)/2:y=h*0.40:enable='gte(t,${Math.max(0, total - 4.5).toFixed(2)})'`)
    // Bottom label.
    filters.push(`drawtext=fontfile='${FONT_SEMI}':textfile='${tf("label.txt", opts.label || "Catherine Gomez Realtor")}':fontsize=50:fontcolor=white:${shadow}:` +
      `x=(w-text_w)/2:y=h*0.885`)
    const audio = join(dir, `voice.${opts.audioExt}`)
    writeFileSync(audio, opts.audio)
    const inputs = ["-i", base, "-i", audio]
    let graph = `[0:v]${filters.join(",\n")}[v];\n`
    if (opts.music) {
      const m = join(dir, `music.${opts.music.ext || "mp3"}`)
      writeFileSync(m, opts.music.data)
      inputs.push("-stream_loop", "-1", "-i", m)
      // Music under the voice: low bed, ducked further while she speaks,
      // faded in/out so it never starts or stops abruptly.
      graph += `[1:a]aresample=44100,asplit=2[vo][sc];` +
        // The narration runs almost non-stop, so heavy ducking made the music
        // inaudible: keep the bed clearly present and dip it only gently.
        `[2:a]aresample=44100,volume=0.45,afade=t=in:d=1,afade=t=out:st=${Math.max(0, total - 2).toFixed(2)}:d=2[bed];` +
        `[bed][sc]sidechaincompress=threshold=0.12:ratio=2.5:attack=40:release=350[duck];` +
        `[vo][duck]amix=inputs=2:duration=first:normalize=0[a]`
    } else {
      graph += `[1:a]anull[a]`
    }
    const filterFile = tf("graph.txt", graph)
    const out = join(dir, "short.mp4")
    await run(ff, ["-y", ...inputs, "-filter_complex_script", filterFile,
      "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "160k", "-t", total.toFixed(2), "-movflags", "+faststart", out])
    return readFileSync(out)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
