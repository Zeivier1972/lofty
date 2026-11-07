import { randomBytes } from "crypto"
import { v2 as cloudinary } from "cloudinary"
import { prisma } from "@/lib/prisma"
import { createVideo, getVideoStatus, isFailed, isFinished } from "@/lib/heygen"
import { getHeyGenAvatar } from "@/lib/social-autopilot"
import { PROJECTS, detectProject, type Project } from "@/lib/projects"
import { sendEmail } from "@/lib/email"
import { sendSMS, toE164 } from "@/lib/sms"

/**
 * Personalized video page per lead: Catherine's HeyGen avatar greets the lead
 * by first name about the project they asked about, on a page of their own
 * (/v/[token]) with the project card and the booking calendar.
 *
 * Flow: startPersonalVideo() writes the row and asks HeyGen to render →
 * processPersonalVideos() (cron, every 5 min) picks up finished renders, copies
 * the file to Cloudinary because HeyGen's links expire after a few days, and
 * sends the lead the link → the page reports views back so Catherine knows who
 * watched before she calls.
 *
 * Honesty: the page and the email say the video was made with Catherine's
 * image and voice using AI. Distrustful leads who later learn it was AI and
 * nobody said so would read it as a trick — the opposite of the point.
 */

const BASE = (process.env.NEXT_PUBLIC_APP_URL || "https://www.catherinegomezrealtor.com").replace(/\/$/, "")
/** Renders per day across all leads: HeyGen API credits are finite. */
const DAILY_CAP = Number(process.env.PERSONAL_VIDEO_DAILY_CAP || 15)
/** Setting row that turns automatic videos for new project leads on/off. */
export const AUTO_SETTING = "personal_video_auto"
/** Setting row (JSON) with the avatar Catherine picked for these videos. */
export const AVATAR_SETTING = "personal_video_avatar"

export type ChosenAvatar = { id: string; name: string; preview: string | null; isTalkingPhoto: boolean }

export async function chosenAvatar(): Promise<ChosenAvatar | null> {
  const row = await prisma.setting.findUnique({ where: { key: AVATAR_SETTING } }).catch(() => null)
  if (!row?.value) return null
  try {
    const a = JSON.parse(row.value)
    return a?.id ? { id: String(a.id), name: String(a.name || ""), preview: a.preview || null, isTalkingPhoto: a.isTalkingPhoto !== false } : null
  } catch { return null }
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export const personalVideoUrl = (token: string) => `${BASE}/v/${token}`

/** "Juan carlos" / "MARÍA" → "Juan" / "María"; null when it isn't a usable name. */
function speakableFirstName(raw: string | null | undefined): string | null {
  const first = String(raw || "").trim().split(/\s+/)[0] || ""
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ'-]{2,20}$/.test(first) || /^lead$/i.test(first)) return null
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
}

/** "$419,900" → "419 mil 900 dólares", "$1,160,250" → "1 millón 160 mil 250 dólares", for the voice. */
function spokenMoney(text: string): string {
  return text.replace(/\$\s?([\d,]+)/g, (_, num: string) => {
    const n = Number(num.replace(/,/g, ""))
    if (!Number.isFinite(n) || n < 1000) return `${num} dólares`
    const millions = Math.floor(n / 1_000_000)
    const thousands = Math.floor((n % 1_000_000) / 1000)
    const rest = n % 1000
    const parts: string[] = []
    if (millions) parts.push(millions === 1 ? "1 millón" : `${millions} millones`)
    if (thousands) parts.push(`${thousands} mil`)
    if (rest) parts.push(String(rest))
    return `${parts.join(" ")} dólares`
  })
}

/** About 30-35 seconds spoken. Only facts already published on the project page. */
export function buildScript(firstName: string, project: Project | null): string {
  const about = project
    ? `Vi que te interesa ${project.name}, en ${project.place}. ${spokenMoney(project.highlight)}.`
    : "Vi que te interesa invertir en bienes raíces en Miami."
  return [
    `Hola ${firstName}, soy Catherine Gomez, tu agente de bienes raíces en Miami.`,
    about,
    "Te preparé esta página con la información del proyecto y mi calendario.",
    "Agenda una llamada de 30 minutos conmigo por Zoom, sin compromiso, y te muestro los números y el plan de pagos según tu presupuesto.",
    "¡Te espero!",
  ].join(" ")
}

async function rendersToday(): Promise<number> {
  const since = new Date(Date.now() - 24 * 3600 * 1000)
  return prisma.personalVideo.count({ where: { createdAt: { gte: since }, status: { not: "FAILED" } } })
}

export type StartResult = { ok: true; id: string; token: string } | { ok: false; error: string }

/** Create the row and ask HeyGen to render. Safe to call twice: an open video for the same contact is reused. */
export async function startPersonalVideo(opts: {
  contactId: string
  projectHref?: string | null
  createdBy: string
  /** Manual requests from Catherine skip the daily cap. */
  ignoreCap?: boolean
  /** "Hacer de nuevo": retire the open video for this project and render a fresh one. */
  replace?: boolean
}): Promise<StartResult> {
  const contact = await prisma.contact.findUnique({
    where: { id: opts.contactId },
    select: { id: true, firstName: true, email: true, phone: true, doNotEmail: true, doNotText: true, sofiaPausedAt: true, isArchived: true },
  })
  if (!contact || contact.isArchived) return { ok: false, error: "Contacto no encontrado" }
  if (!contact.email && !contact.phone) return { ok: false, error: "El contacto no tiene correo ni teléfono para recibir el video" }
  const firstName = speakableFirstName(contact.firstName)
  if (!firstName) return { ok: false, error: "Falta el nombre del contacto (el video lo saluda por su nombre)" }

  const project = opts.projectHref ? PROJECTS.find(p => p.href === opts.projectHref) || null : null

  const open = await prisma.personalVideo.findFirst({
    where: { contactId: contact.id, projectHref: project?.href ?? null, status: { in: ["PENDING", "RENDERING", "READY", "SENT"] } },
    select: { id: true, token: true },
  })
  if (open && !opts.replace) return { ok: true, id: open.id, token: open.token }
  if (open && opts.replace) {
    await prisma.personalVideo.update({ where: { id: open.id }, data: { status: "REPLACED" } })
  }

  if (!opts.ignoreCap && (await rendersToday()) >= DAILY_CAP) {
    return { ok: false, error: `Límite diario de videos alcanzado (${DAILY_CAP})` }
  }

  const script = buildScript(firstName, project)
  const row = await prisma.personalVideo.create({
    data: {
      token: randomBytes(12).toString("base64url"),
      contactId: contact.id,
      projectHref: project?.href ?? null,
      firstName,
      script,
      createdBy: opts.createdBy,
    },
  })

  // Voice from the social autopilot's pick (Catherine's "Catalina" voice);
  // avatar = the one chosen in the Video personal panel, else the day's look.
  const auto = await getHeyGenAvatar(new Date().getDay())
  const picked = await chosenAvatar()
  const avatar = auto ? { avatarId: picked?.id || auto.avatarId, voiceId: auto.voiceId } : null
  if (!avatar) {
    await prisma.personalVideo.update({ where: { id: row.id }, data: { status: "FAILED", error: "HeyGen no disponible (avatar o voz)" } })
    return { ok: false, error: "HeyGen no disponible (avatar o voz)" }
  }
  const bg = project ? `${BASE}${project.img}` : `${BASE}/parkside/fachada-atardecer.jpg`
  const res = await createVideo(
    {
      scenes: [{ kind: "avatar", avatarId: avatar.avatarId, voiceId: avatar.voiceId, script, background: { type: "image", url: bg } }],
      // Portrait: almost every lead opens this on a phone.
      width: 720,
      height: 1280,
      caption: false,
      title: `Video personal — ${firstName}${project ? ` — ${project.name}` : ""}`,
    },
    picked && !picked.isTalkingPhoto ? new Set<string>() : new Set([avatar.avatarId]),
  )
  if (!res.videoId) {
    await prisma.personalVideo.update({ where: { id: row.id }, data: { status: "FAILED", error: (res.error || "HeyGen no aceptó el video").slice(0, 300) } })
    return { ok: false, error: res.error || "HeyGen no aceptó el video" }
  }
  await prisma.personalVideo.update({ where: { id: row.id }, data: { status: "RENDERING", heygenVideoId: res.videoId } })
  await prisma.activity.create({
    data: { type: "NOTE_ADDED", title: "🎬 Video personal en preparación", description: `${project?.name || "Inversión en Miami"} — se envía al estar listo.`, contactId: contact.id },
  }).catch(() => {})
  return { ok: true, id: row.id, token: row.token }
}

/** A new lead whose tags name one of the projects gets a video automatically, when turned on. */
export async function maybeAutoPersonalVideo(contactId: string, hints: (string | null | undefined)[]): Promise<void> {
  const setting = await prisma.setting.findUnique({ where: { key: AUTO_SETTING } }).catch(() => null)
  if (setting?.value !== "on") return
  const project = hints.map(h => detectProject(h)).find(Boolean)
  if (!project) return
  const r = await startPersonalVideo({ contactId, projectHref: project.href, createdBy: "automático" })
  if (!r.ok) console.log(`[personal-video] auto skipped for ${contactId}: ${r.error}`)
}

async function deliver(v: { id: string; token: string; contactId: string; firstName: string; projectHref: string | null }): Promise<boolean> {
  const contact = await prisma.contact.findUnique({
    where: { id: v.contactId },
    select: { email: true, phone: true, sofiaPausedAt: true },
  })
  if (!contact || contact.sofiaPausedAt) return false
  const project = v.projectHref ? PROJECTS.find(p => p.href === v.projectHref) : null
  const url = personalVideoUrl(v.token)
  const about = project ? project.name : "tu inversión en Miami"
  let sent = false

  if (contact.email) {
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:8px 0">
      <h2 style="color:#0c4a6e;margin:0 0 10px">${v.firstName}, te preparé un video</h2>
      <p style="color:#334155;line-height:1.6">Es corto (menos de un minuto) y es sobre ${about}. En la misma página tienes la información del proyecto y mi calendario para agendar 30 minutos por Zoom.</p>
      <p style="text-align:center;margin:26px 0"><a href="${url}" style="background:#0369a1;color:#fff;padding:14px 32px;border-radius:50px;text-decoration:none;font-weight:bold;display:inline-block">▶ Ver mi video</a></p>
      <p style="color:#94a3b8;font-size:12px">Video creado con mi imagen y mi voz con ayuda de inteligencia artificial.</p>
      <p style="color:#64748b;font-size:12px;margin-top:22px;border-top:1px solid #e2e8f0;padding-top:12px">Catherine Gomez, Realtor · Licencia de Florida #3320405 · 305-283-0872</p>
    </div>`
    sent = await sendEmail({ to: contact.email, subject: `${v.firstName}, te preparé un video sobre ${about}`, html }).catch(() => false)
  }
  if (contact.phone) {
    const sid = await sendSMS(
      toE164(contact.phone),
      `${v.firstName}, soy Catherine Gomez. Te prepare un video corto sobre ${about}: ${url}`,
      undefined,
      { automated: true, contactId: v.contactId, quietHours: true },
    ).catch(() => null)
    sent = sent || !!sid
  }
  return sent
}

/** Cron: finish renders, store them for good, send them. */
export async function processPersonalVideos(): Promise<string[]> {
  const notes: string[] = []
  const rendering = await prisma.personalVideo.findMany({
    where: { status: "RENDERING", heygenVideoId: { not: null } },
    take: 20,
    orderBy: { createdAt: "asc" },
  })
  for (const v of rendering) {
    try {
      const st = await getVideoStatus(v.heygenVideoId!)
      if (isFailed(st.status)) {
        await prisma.personalVideo.update({ where: { id: v.id }, data: { status: "FAILED", error: `HeyGen: ${st.status}` } })
        notes.push(`✗ ${v.firstName}: HeyGen ${st.status}`)
        continue
      }
      // Give up on renders stuck for a day.
      if (isFinished(st.status) && !st.videoUrl) {
        notes.push(`? ${v.firstName}: HeyGen terminó pero sin URL — ${JSON.stringify(st.raw).slice(0, 400)}`)
      } else if (!isFinished(st.status)) {
        notes.push(`… ${v.firstName}: HeyGen ${st.status}`)
      }
      if (!isFinished(st.status) || !st.videoUrl) {
        if (Date.now() - v.createdAt.getTime() > 24 * 3600 * 1000) {
          await prisma.personalVideo.update({ where: { id: v.id }, data: { status: "FAILED", error: "HeyGen no terminó en 24 h" } })
        }
        continue
      }
      const up = await cloudinary.uploader.upload(st.videoUrl, {
        resource_type: "video",
        folder: "personal-videos",
        public_id: v.token,
        overwrite: true,
      })
      await prisma.personalVideo.update({ where: { id: v.id }, data: { status: "READY", videoUrl: up.secure_url } })
      notes.push(`✓ ${v.firstName}: listo`)
    } catch (e: any) {
      notes.push(`✗ ${v.firstName}: ${e?.message || e}`)
    }
  }

  const ready = await prisma.personalVideo.findMany({ where: { status: "READY", sentAt: null }, take: 20 })
  for (const v of ready) {
    const ok = await deliver(v)
    await prisma.personalVideo.update({ where: { id: v.id }, data: ok ? { status: "SENT", sentAt: new Date() } : { status: "READY" } })
    if (ok) {
      await prisma.activity.create({
        data: { type: "NOTE_ADDED", title: "🎬 Video personal enviado", description: personalVideoUrl(v.token), contactId: v.contactId },
      }).catch(() => {})
      notes.push(`✓ ${v.firstName}: enviado`)
    }
  }
  return notes
}

/** The page reports progress; Catherine hears about the first view and a near-complete one, once each. */
export async function recordView(token: string, pct: number): Promise<void> {
  const v = await prisma.personalVideo.findUnique({
    where: { token },
    select: { id: true, contactId: true, firstName: true, views: true, maxPct: true, projectHref: true, contact: { select: { firstName: true, lastName: true } } },
  })
  if (!v) return
  const p = Math.max(0, Math.min(100, Math.round(pct)))
  const now = new Date()
  const first = v.views === 0
  await prisma.personalVideo.update({
    where: { id: v.id },
    data: {
      ...(p === 0 ? { views: { increment: 1 } } : {}),
      ...(first ? { firstViewedAt: now } : {}),
      lastViewedAt: now,
      maxPct: Math.max(v.maxPct, p),
    },
  })
  const who = `${v.contact.firstName} ${v.contact.lastName || ""}`.trim()
  const project = v.projectHref ? PROJECTS.find(x => x.href === v.projectHref)?.name : null
  if (p === 0 && first) {
    await prisma.aINotification.create({
      data: {
        type: "LEAD_REPLY",
        title: `🎬 ${who} abrió su video personal`,
        body: `${project || "Inversión en Miami"}. Buen momento para escribirle o llamarle.`,
        priority: "HIGH",
        contactId: v.contactId,
      },
    }).catch(() => {})
  }
  if (v.maxPct < 75 && p >= 75) {
    await prisma.activity.create({
      data: { type: "NOTE_ADDED", title: "🎬 Vio casi todo su video personal", description: `${p}% — ${project || "Inversión en Miami"}`, contactId: v.contactId },
    }).catch(() => {})
    await prisma.contact.update({ where: { id: v.contactId }, data: { leadScore: { increment: 10 } } }).catch(() => {})
  }
}
