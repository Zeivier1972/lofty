import { spawn } from "child_process"
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { ffmpegPath } from "@/lib/local-video"
import { PILOT_SCENES, CARD_DATA, type PilotScene, type Shot } from "@/lib/pilot-plan"

/**
 * Edits the 16:9 pilot like a documentary, on our own server.
 *
 * HeyGen renders only the A-roll: Catherine's avatar speaking the whole plan,
 * every scene on camera. We then cut away to B-roll where the plan says so,
 * keeping her voice underneath. Scene boundaries come from Whisper word
 * timings of that render, so each cutaway starts on the word it illustrates
 * (HeyGen's own B-roll scenes stretch or loop a clip to the narration, which
 * is how the old videos drifted out of sync).
 */

const W = 1920
const H = 1080
const FPS = 30
const PUB = join(process.cwd(), "public")
const FONT_SERIF = join(PUB, "fonts/DMSerifDisplay-Regular.ttf")
const FONT_SEMI = join(PUB, "fonts/Inter-SemiBold.otf")
const FONT_BLACK = join(PUB, "fonts/Inter-Black.otf")
const FONT_ANTON = join(PUB, "fonts/Anton-Regular.ttf")

// "Brickell Editorial" brand kit in HeyGen.
const INK = "0x121212"
const PAPER = "0xEAEAEA"
const GOLD = "0xC5A059"
const GREY = "0x8C8C8C"

export type Word = { word: string; start: number; end: number }
export type SceneTiming = { id: string; start: number; end: number }

function ff(): string {
  const p = ffmpegPath()
  if (!p) throw new Error("ffmpeg not available")
  return p
}

function run(args: string[], timeoutMs = 10 * 60000): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(ff(), args, { stdio: ["ignore", "ignore", "pipe"] })
    let err = ""
    p.stderr.on("data", d => { err = (err + d.toString()).slice(-8000) })
    const t = setTimeout(() => { p.kill("SIGKILL"); reject(new Error("ffmpeg timeout")) }, timeoutMs)
    p.on("close", code => { clearTimeout(t); code === 0 ? resolve(err) : reject(new Error(`ffmpeg exit ${code}: ${err.slice(-700)}`)) })
    p.on("error", e => { clearTimeout(t); reject(e) })
  })
}

/** Duration and size of a media file (ffmpeg -i prints them and exits 1). */
export function probe(file: string): Promise<{ duration: number; width: number; height: number }> {
  return new Promise(resolve => {
    const p = spawn(ff(), ["-hide_banner", "-i", file], { stdio: ["ignore", "ignore", "pipe"] })
    let err = ""
    p.stderr.on("data", d => { err += d.toString() })
    p.on("close", () => {
      const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(err)
      const s = /Video:.*?(\d{3,5})x(\d{3,5})/.exec(err)
      resolve({
        duration: d ? +d[1] * 3600 + +d[2] * 60 + parseFloat(d[3]) : 0,
        width: s ? +s[1] : 0,
        height: s ? +s[2] : 0,
      })
    })
  })
}

const ENC = ["-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p", "-r", String(FPS), "-g", String(FPS * 2)]

/* ------------------------------------------------------------ alignment --- */

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ]/g, "")

/**
 * Where each scene starts in the avatar render. Each scene's first two words
 * are searched for near where they should be; the cut goes in the pause
 * before them. Falls back to the proportional position.
 */
export function alignScenes(scenes: PilotScene[], words: Word[], total: number): SceneTiming[] {
  const ws = words.map(w => ({ ...w, n: norm(w.word) })).filter(w => w.n)
  const toks = scenes.map(s => s.narration.split(/\s+/).map(norm).filter(Boolean))
  const planTotal = toks.reduce((a, t) => a + t.length, 0)
  const scale = ws.length / Math.max(1, planTotal)
  const starts: number[] = [0]
  let cum = 0
  let lastIdx = 0
  for (let i = 1; i < scenes.length; i++) {
    cum += toks[i - 1].length
    const expected = Math.round(cum * scale)
    const [a, b] = toks[i]
    let best = -1
    for (let j = Math.max(lastIdx + 1, expected - 15); j <= Math.min(ws.length - 1, expected + 15); j++) {
      if (ws[j].n !== a) continue
      if (b && ws[j + 1] && ws[j + 1].n !== b) continue
      if (best < 0 || Math.abs(j - expected) < Math.abs(best - expected)) best = j
    }
    const j = best >= 0 ? best : Math.min(ws.length - 1, Math.max(lastIdx + 1, expected))
    if (best < 0) console.warn(`[pilot] scene ${scenes[i].id}: start words not found, using position ${j}`)
    lastIdx = j
    const t = j > 0 ? (ws[j - 1].end + ws[j].start) / 2 : ws[j]?.start ?? 0
    starts.push(Math.max(starts[starts.length - 1] + 1, t))
  }
  return scenes.map((s, i) => ({ id: s.id, start: starts[i], end: i + 1 < starts.length ? starts[i + 1] : total }))
}

/** YouTube chapters: first at 0:00, each at least 10 s. */
export function chaptersFrom(scenes: PilotScene[], timings: SceneTiming[], total: number): { at: number; title: string }[] {
  const raw = scenes.map((s, i) => ({ at: i === 0 ? 0 : Math.floor(timings[i].start), title: s.chapter })).filter(c => c.title) as { at: number; title: string }[]
  const out: { at: number; title: string }[] = []
  for (const c of raw) {
    if (out.length && c.at - out[out.length - 1].at < 10) continue
    out.push(c)
  }
  while (out.length > 1 && total - out[out.length - 1].at < 10) out.pop()
  return out
}

/* ---------------------------------------------------------------- shots --- */

type Ctx = { dir: string; n: number }

function textFile(ctx: Ctx, text: string): string {
  const p = join(ctx.dir, `t${ctx.n++}.txt`)
  writeFileSync(p, text, "utf8")
  return p
}

/** drawtext with a fade-in at `at` seconds (and optional fade-out at `until`). */
function txt(ctx: Ctx, o: { text: string; font: string; size: number; color: string; x: string; y: string; at?: number; until?: number; shadow?: boolean; box?: string }): string {
  const at = o.at ?? 0
  const alpha = o.at === undefined && !o.until ? "1" : o.until
    ? `if(lt(t,${at}),0,if(gt(t,${o.until}),max(0,1-(t-${o.until})/0.4),min(1,(t-${at})/0.5)))`
    : `if(lt(t,${at}),0,min(1,(t-${at})/0.5))`
  const sh = (o.shadow ? ":shadowcolor=black@0.55:shadowx=2:shadowy=2" : "") + (o.box ? `:box=1:boxcolor=${o.box}:boxborderw=26` : "")
  return `drawtext=fontfile='${o.font}':textfile='${textFile(ctx, o.text)}':fontsize=${o.size}:fontcolor=${o.color}:x=${o.x}:y=${o.y}:alpha='${alpha}':expansion=none${sh}`
}

/** Smoothstep 0→1 over the shot, as an ffmpeg expression of the frame number. */
const ease = (n: number) => `(min(1,on/${Math.max(1, n - 1)})*min(1,on/${Math.max(1, n - 1)})*(3-2*min(1,on/${Math.max(1, n - 1)})))`

function zoompan(move: "in" | "out" | "left" | "right" | "drift", n: number): string {
  const p = ease(n)
  const c = { x: "iw/2-(iw/zoom/2)", y: "ih/2-(ih/zoom/2)" }
  const m = {
    in: { z: `1+0.09*${p}`, ...c },
    out: { z: `1.09-0.09*${p}`, ...c },
    left: { z: "1.12", x: `(iw-iw/zoom)*(1-${p})`, y: c.y },
    right: { z: "1.12", x: `(iw-iw/zoom)*${p}`, y: c.y },
    drift: { z: `1.04+0.04*${p}`, ...c },
  }[move]
  // Work at 4K and scale down so the slow move does not step pixel by pixel.
  return `scale=3840:2160:force_original_aspect_ratio=increase,crop=3840:2160,setsar=1,zoompan=z='${m.z}':x='${m.x}':y='${m.y}':d=${n}:s=3840x2160:fps=${FPS},scale=${W}:${H}:flags=lanczos`
}

/** A bottom-to-top dark gradient so text over a photo stays readable. */
async function gradient(dir: string): Promise<string> {
  const out = join(dir, "grad.png")
  if (!existsSync(out)) {
    await run(["-y", "-f", "lavfi", "-i", `color=black:s=${W}x${H}`, "-frames:v", "1",
      "-vf", `format=rgba,geq=r=0:g=0:b=0:a='255*0.82*pow(max(0,(Y-H*0.5)/(H*0.5)),1.4)'`, out])
  }
  return out
}

async function encode(ctx: Ctx, inputs: string[], graph: string, frames: number, out: string) {
  const gf = join(ctx.dir, `g${ctx.n++}.txt`)
  writeFileSync(gf, graph, "utf8")
  await run(["-y", ...inputs, "-filter_complex_script", gf, "-map", "[v]", "-frames:v", String(frames), ...ENC, out])
}

const renderTag = (ctx: Ctx) => txt(ctx, { text: "Render del desarrollador", font: FONT_SEMI, size: 24, color: "white@0.75", x: "w-text_w-56", y: "h-64", shadow: true })

async function stillShot(ctx: Ctx, shot: Extract<Shot, { kind: "still" }>, frames: number, out: string) {
  const grad = await gradient(ctx.dir)
  const f: string[] = []
  if (shot.title) {
    f.push(`drawbox=x=96:y=ih-218:w=64:h=4:color=${GOLD}:t=fill`)
    f.push(txt(ctx, { text: shot.title, font: FONT_SERIF, size: 66, color: PAPER, x: "96", y: shot.sub ? "h-196" : "h-176", at: 0.3, shadow: true }))
  }
  if (shot.sub) f.push(txt(ctx, { text: shot.sub, font: FONT_SEMI, size: 34, color: GOLD, x: "96", y: "h-108", at: 0.7, shadow: true }))
  f.push(renderTag(ctx))
  const graph = `[0:v]${zoompan(shot.move, frames)}[bg];[1:v]format=rgba[g];[bg][g]overlay=0:0,format=yuv420p,${f.join(",")}[v]`
  await encode(ctx, ["-i", join(PUB, "parkside", shot.image), "-i", grad], graph, frames, out)
}

async function tourShot(ctx: Ctx, tour: string, startAt: number, frames: number, out: string) {
  const f = [
    txt(ctx, { text: "Recorrido 3D", font: FONT_SERIF, size: 78, color: PAPER, x: "150", y: "h/2-90", at: 0.3 }),
    `drawbox=x=150:y=ih/2+12:w=64:h=4:color=${GOLD}:t=fill`,
    txt(ctx, { text: "Render del desarrollador", font: FONT_SEMI, size: 34, color: GOLD, x: "150", y: "h/2+40", at: 0.6 }),
    txt(ctx, { text: "Parkside Residences at Brickell", font: FONT_SEMI, size: 30, color: GREY, x: "150", y: "h/2+96", at: 0.8 }),
  ]
  const graph = [
    `[0:v]fps=${FPS},setsar=1,split[a][b]`,
    `[a]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},gblur=sigma=40,drawbox=x=0:y=0:w=iw:h=ih:color=${INK}@0.62:t=fill[bg]`,
    `[b]scale=-2:${H - 80}[fg]`,
    `[bg][fg]overlay=x=W-w-260:y=40,${f.join(",")}[v]`,
  ].join(";")
  await encode(ctx, ["-ss", String(startAt), "-i", tour], graph, frames, out)
}

/** Blurred, darkened render behind a graphic, with a very slow push-in. */
function cardBg(image: string, frames: number): { input: string[]; chain: string } {
  return {
    input: ["-i", join(PUB, "parkside", image)],
    chain: `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},gblur=sigma=28,${zoompan("drift", frames)},drawbox=x=0:y=0:w=iw:h=ih:color=${INK}@0.80:t=fill`,
  }
}

async function cardShot(ctx: Ctx, card: "prices" | "schedule" | "cta", frames: number, out: string, cues: (number | null)[] = []) {
  const sec = frames / FPS
  const f: string[] = []
  let bg: { input: string[]; chain: string }

  if (card === "prices") {
    bg = cardBg("fachada-frontal.jpg", frames)
    f.push(txt(ctx, { text: "PARKSIDE RESIDENCES AT BRICKELL", font: FONT_SEMI, size: 28, color: GOLD, x: "160", y: "170" }))
    f.push(txt(ctx, { text: "Precios desde", font: FONT_SERIF, size: 88, color: PAPER, x: "160", y: "215", at: 0.15 }))
    CARD_DATA.units.forEach((u, i) => {
      const y = 410 + i * 140
      const at = 0.6 + i * 0.55
      f.push(`drawbox=x=160:y=${y + 104}:w=${W - 320}:h=1:color=${GOLD}@0.35:t=fill`)
      f.push(txt(ctx, { text: u.type, font: FONT_SERIF, size: 58, color: PAPER, x: "160", y: String(y + 18), at }))
      f.push(txt(ctx, { text: u.size, font: FONT_SEMI, size: 34, color: GREY, x: "800", y: String(y + 36), at }))
      f.push(txt(ctx, { text: u.from, font: FONT_SERIF, size: 64, color: GOLD, x: `${W - 160}-text_w`, y: String(y + 12), at }))
    })
    f.push(txt(ctx, { text: `Precios del desarrollador al ${CARD_DATA.asOf}. Pueden cambiar.`, font: FONT_SEMI, size: 26, color: GREY, x: "160", y: "h-130", at: 2.2 }))
  } else if (card === "schedule") {
    bg = cardBg("sala-vista.jpg", frames)
    f.push(txt(ctx, { text: `PLAN DE PAGOS · ESTUDIO DESDE ${CARD_DATA.studioPrice}`, font: FONT_SEMI, size: 28, color: GOLD, x: "160", y: "150" }))
    f.push(txt(ctx, { text: "Cómo se paga", font: FONT_SERIF, size: 88, color: PAPER, x: "160", y: "195", at: 0.15 }))
    const x0 = 260
    const step = (W - 2 * x0) / 3
    f.push(`drawbox=x=${x0}:y=598:w=${W - 2 * x0}:h=3:color=${GOLD}@0.5:t=fill`)
    // When each payment appears, in step with the narration (fraction of the scene).
    // Spoken cue (seconds into the card) when Whisper found it, else a share of the card.
    const when = [0.03, 0.42, 0.58, 0.8]
    CARD_DATA.deposits.forEach((d, i) => {
      const cx = Math.round(x0 + i * step)
      const cue = cues[i]
      const at = +(cue != null && cue >= 0 && cue < sec - 0.5 ? Math.max(0.1, cue - 0.2) : when[i] * sec).toFixed(2)
      f.push(`drawbox=x=${cx - 11}:y=588:w=22:h=22:color=${GOLD}:t=fill:enable='gte(t,${at})'`)
      f.push(txt(ctx, { text: d.pct, font: FONT_SERIF, size: 96, color: GOLD, x: `${cx}-text_w/2`, y: "440", at }))
      f.push(txt(ctx, { text: d.amount, font: FONT_SEMI, size: 46, color: PAPER, x: `${cx}-text_w/2`, y: "650", at: at + 0.15 }))
      f.push(txt(ctx, { text: d.when, font: FONT_SEMI, size: 32, color: GREY, x: `${cx}-text_w/2`, y: "718", at: at + 0.25 }))
    })
    f.push(txt(ctx, { text: "Entrega estimada: 1er trimestre de 2028. Precios y fechas del desarrollador; pueden cambiar.", font: FONT_SEMI, size: 28, color: GREY, x: "160", y: "h-130", at: 0.8 }))
  } else {
    bg = cardBg("fachada-atardecer.jpg", frames)
    f.push(txt(ctx, { text: "Hablemos 15 minutos", font: FONT_SERIF, size: 104, color: PAPER, x: "(w-text_w)/2", y: "300", at: 0.1 }))
    f.push(txt(ctx, { text: "Sin compromiso · Zoom o teléfono · En español", font: FONT_SEMI, size: 38, color: GREY, x: "(w-text_w)/2", y: "440", at: 0.4 }))
    f.push(`drawbox=x=(iw-1180)/2:y=540:w=1180:h=112:color=${GOLD}:t=fill:enable='gte(t,0.7)'`)
    f.push(txt(ctx, { text: CARD_DATA.bookLabel, font: FONT_SEMI, size: 40, color: INK, x: "(w-text_w)/2", y: "576", at: 0.7 }))
    f.push(txt(ctx, { text: "Enlace en la descripción", font: FONT_SEMI, size: 32, color: PAPER, x: "(w-text_w)/2", y: "700", at: 1.0 }))
    f.push(txt(ctx, { text: "Catherine Gomez · Realtor en Miami · Licencia de Florida #3320405", font: FONT_SEMI, size: 26, color: GREY, x: "(w-text_w)/2", y: "h-110", at: 1.2 }))
  }
  await encode(ctx, bg.input, `${bg.chain},${f.join(",")}[v]`, frames, out)
}

async function avatarShot(ctx: Ctx, avatar: string, start: number, frames: number, lowerThird: boolean, out: string) {
  const f = [`scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},setsar=1`]
  if (lowerThird) {
    const on = "enable='between(t,0.5,6.4)'"
    f.push(`drawbox=x=80:y=ih-250:w=640:h=160:color=${INK}@0.72:t=fill:${on}`)
    f.push(`drawbox=x=80:y=ih-250:w=6:h=160:color=${GOLD}:t=fill:${on}`)
    f.push(txt(ctx, { text: "Catherine Gomez", font: FONT_SERIF, size: 58, color: PAPER, x: "116", y: "h-232", at: 0.5, until: 6 }))
    f.push(txt(ctx, { text: "Realtor en Miami", font: FONT_SEMI, size: 32, color: GOLD, x: "118", y: "h-150", at: 0.7, until: 6 }))
  }
  await encode(ctx, ["-ss", start.toFixed(3), "-i", avatar], `[0:v]${f.join(",")}[v]`, frames, out)
}

/* ---------------------------------------------------------------- edit --- */

export type EditResult = { video: Buffer; timings: SceneTiming[]; duration: number; shots: { scene: string; kind: string; seconds: number }[] }

/**
 * avatar: HeyGen's 16:9 render of the whole narration. tour: the 3D tour mp4.
 * words: Whisper word timings of the avatar render's audio.
 */
export async function editPilot(opts: { avatar: Buffer; tour: Buffer | null; words: Word[] }): Promise<EditResult> {
  const dir = mkdtempSync(join(tmpdir(), "pilot-"))
  const ctx: Ctx = { dir, n: 0 }
  try {
    const avatar = join(dir, "avatar.mp4")
    writeFileSync(avatar, opts.avatar)
    const tour = opts.tour ? join(dir, "tour.mp4") : null
    if (tour && opts.tour) writeFileSync(tour, opts.tour)
    const { duration } = await probe(avatar)
    if (!duration) throw new Error("could not read the avatar video")

    const timings = alignScenes(PILOT_SCENES, opts.words, duration)
    const parts: string[] = []
    const shots: EditResult["shots"] = []
    // Frame-exact boundaries so the cut list adds up to the audio.
    const frameAt = (t: number) => Math.round(t * FPS)

    for (let i = 0; i < PILOT_SCENES.length; i++) {
      const scene = PILOT_SCENES[i]
      const f0 = frameAt(timings[i].start)
      const f1 = i === PILOT_SCENES.length - 1 ? frameAt(duration) : frameAt(timings[i].end)
      const frames = Math.max(1, f1 - f0)
      const list = scene.mode === "avatar" || !scene.shots.length ? [null] : scene.shots
      const inScene = opts.words.filter(w => w.start >= timings[i].start - 0.05 && w.start < timings[i].end)
      /** Seconds into the scene where a word starting with `cue` is spoken (cut in the pause before it). */
      const cueAt = (cue: string, from = 0): number | null => {
        const idx = inScene.findIndex(w => w.start - timings[i].start >= from && norm(w.word).startsWith(cue))
        if (idx < 0) return null
        const w = inScene[idx]
        const prevEnd = idx > 0 ? inScene[idx - 1].end : w.start
        return (prevEnd + w.start) / 2 - timings[i].start
      }
      // Each shot starts on its cue word, else the scene is split evenly.
      const bounds: number[] = [0]
      for (let k = 1; k < list.length; k++) {
        const s = list[k] as Shot | null
        const even = Math.round((frames * k) / list.length)
        const c = s && "cue" in s && s.cue ? cueAt(s.cue) : null
        const f = c != null ? Math.round(c * FPS) : even
        bounds.push(f > bounds[k - 1] + FPS * 1.5 && f < frames - FPS * 1.5 ? f : Math.max(bounds[k - 1] + 1, even))
      }
      bounds.push(frames)
      for (let k = 0; k < list.length; k++) {
        const n = Math.max(1, bounds[k + 1] - bounds[k])
        const shotStart = bounds[k] / FPS
        const out = join(dir, `p${parts.length}.mp4`)
        const shot = list[k]
        if (!shot) await avatarShot(ctx, avatar, f0 / FPS, n, i === 0, out)
        else if (shot.kind === "still") await stillShot(ctx, shot, n, out)
        else if (shot.kind === "card") {
          const cues = (shot.cues || []).map(c => { const t = cueAt(c, shotStart); return t == null ? null : t - shotStart })
          await cardShot(ctx, shot.card, n, out, cues)
        }
        else if (tour) await tourShot(ctx, tour, shot.startAt, n, out)
        else await stillShot(ctx, { kind: "still", image: "fachada-frontal.jpg", move: "in", title: "Parkside Residences at Brickell" }, n, out)
        parts.push(out)
        shots.push({ scene: scene.id, kind: shot ? shot.kind : "avatar", seconds: +(n / FPS).toFixed(1) })
      }
    }

    const listFile = join(dir, "list.txt")
    writeFileSync(listFile, parts.map(p => `file '${p}'`).join("\n"))
    const video = join(dir, "video.mp4")
    await run(["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", video])
    const final = join(dir, "final.mp4")
    await run(["-y", "-i", video, "-i", avatar, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", "-movflags", "+faststart", final])
    return { video: readFileSync(final), timings, duration, shots }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** 1280×720 thumbnail: facade render, big question, the deposit in gold. */
export async function renderThumbnail(): Promise<Buffer> {
  const dir = mkdtempSync(join(tmpdir(), "thumb-"))
  const ctx: Ctx = { dir, n: 0 }
  try {
    const out = join(dir, "thumb.jpg")
    const deposit = CARD_DATA.deposits[0].amount
    const graph = [
      `[0:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1[bg]`,
      `color=black:s=1280x720,format=rgba,geq=r=0:g=0:b=0:a='255*0.88*pow(max(0,1-X/(W*0.78)),1.2)'[g]`,
      `[bg][g]overlay=0:0,format=yuv420p,` + [
        txt(ctx, { text: "¿CUÁNTO", font: FONT_ANTON, size: 128, color: "white", x: "56", y: "56", shadow: true }),
        txt(ctx, { text: "NECESITAS?", font: FONT_ANTON, size: 128, color: "white", x: "56", y: "214", shadow: true }),
        txt(ctx, { text: `Separa desde ${deposit}`, font: FONT_BLACK, size: 46, color: INK, x: "82", y: "430", box: GOLD }),
        txt(ctx, { text: "Brickell, Miami · desde Colombia", font: FONT_SEMI, size: 34, color: "white", x: "58", y: "560", shadow: true }),
      ].join(",") + "[v]",
    ].join(";")
    const gf = join(dir, "g.txt")
    writeFileSync(gf, graph)
    await run(["-y", "-i", join(PUB, "parkside", "fachada-atardecer.jpg"), "-filter_complex_script", gf, "-map", "[v]", "-frames:v", "1", "-q:v", "2", out])
    return readFileSync(out)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
