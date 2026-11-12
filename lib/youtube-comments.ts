/**
 * Sofía answers comments on Catherine's YouTube channel.
 *
 * YouTube has no webhook for comments, so /api/cron/youtube-comments polls the
 * channel every 30 minutes (instrumentation.ts). For each new top-level
 * comment from someone else, Sofía writes one short reply in the commenter's
 * language: an answer from the video itself when it has one, and for anyone
 * interested an invitation to a 15-minute conversation with Catherine. YouTube
 * gives no phone or email, so interested commenters also go to Catherine as a
 * HIGH notification with a link to the comment.
 *
 * Guards: comments older than 3 days (no replying to old history on the first
 * run), spam and links, insults (notified, not answered), threads Catherine
 * already answered, and at most MAX_PER_RUN replies a run. Each handled
 * comment leaves an AINotification with metadata `yt-cmt:<id>`, which is
 * also the "already done" marker.
 *
 * Needs the youtube.force-ssl scope: a channel connected before it was added
 * gets a 403, and Catherine one notification asking her to reconnect YouTube.
 * Turn off with Setting `youtube_comment_replies` = "off".
 */

import Anthropic from "@anthropic-ai/sdk"
import { prisma } from "@/lib/prisma"
import { refreshAccessToken } from "@/lib/youtube-upload"
import { detectProject } from "@/lib/projects"
import { isAbusive } from "@/lib/abusive-message"

const anthropic = new Anthropic()
const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://www.catherinegomezrealtor.com"
const API = "https://www.googleapis.com/youtube/v3"
const MAX_PER_RUN = 10
const MAX_AGE_MS = 3 * 86400000

const SPAM = /https?:\/\/|www\.|\bscam\b|bitcoin|crypto|forex|telegram|whats\s?app\s*\+|gana dinero|dm me|follow me|s[ií]gueme|check my channel/i
const INTEREST = /precio|cu[aá]nto|cost|info|interes|detalle|disponib|cotiz|quiero|me gustar[ií]a|c[oó]mo (se )?(compr|invier|hag|pued)|requisit|financ|cr[eé]dito|enganche|cuota|visa|contact|llam|price|how much|interested|\?/i

type Thread = {
  id: string
  snippet: {
    videoId: string
    totalReplyCount: number
    topLevelComment: {
      id: string
      snippet: {
        textOriginal: string
        authorDisplayName: string
        authorChannelId?: { value: string }
        publishedAt: string
      }
    }
  }
  replies?: { comments: { snippet: { authorChannelId?: { value: string } } }[] }
}

export type YouTubeCommentResult = { checked: number; replied: number; skipped: number; error?: string }

async function yt(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

async function notifyOnce(marker: string, title: string, body: string, priority = "HIGH") {
  const seen = await prisma.aINotification.findFirst({ where: { metadata: marker }, select: { id: true } }).catch(() => null)
  if (seen) return
  await prisma.aINotification.create({ data: { type: "YOUTUBE_COMMENT", title, body, priority, metadata: marker } }).catch(() => {})
}

async function writeReply(opts: { comment: string; who: string; videoTitle: string; videoDescription: string; interested: boolean; bookUrl: string }): Promise<string> {
  const first = opts.who.replace(/^@/, "").split(/[\s_.]/)[0] || ""
  const goal = opts.interested
    ? `responde en una o dos frases a lo que preguntó, solo con lo que dice el video; si no está en el video, dile que Catherine se lo explica con gusto. Termina invitando a una conversación de 15 minutos con Catherine, sin compromiso: ${opts.bookUrl}`
    : "agradece de forma cálida y específica a lo que dijo, conectándolo con el tema del video. Sin enlaces."
  try {
    const m = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system:
        "Eres Sofía, la asistente virtual de Catherine Gomez, Realtor en Miami (licencia de Florida #3320405). Respondes comentarios en su canal de YouTube. " +
        "Responde en el idioma del comentario (español latino con tuteo, o inglés). Cálido, breve y humano: máximo 40 palabras, 1 emoji como mucho. " +
        "La respuesta es sobre lo que la persona dijo y el tema de ESE video, nunca genérica. Nunca inventes precios, fechas, rentabilidad ni condiciones que no estén en el video; nunca prometas ingresos ni aprobación de crédito. " +
        "No digas que eres Catherine. Devuelve SOLO el texto de la respuesta.",
      messages: [{
        role: "user",
        content: `Video: "${opts.videoTitle.slice(0, 200)}"\nDescripción del video:\n"""${opts.videoDescription.slice(0, 1500) || "(sin descripción)"}"""\n\nComentario de ${first || "alguien"}: "${opts.comment.slice(0, 500)}"\nObjetivo: ${goal}`,
      }],
    })
    const t = m.content[0]?.type === "text" ? m.content[0].text.trim().replace(/^["“]|["”]$/g, "") : ""
    if (t && t.length <= 400) return t
  } catch { /* template below */ }
  return opts.interested
    ? `¡Hola${first ? ` ${first}` : ""}! Con gusto te ayudamos. Agenda una conversación de 15 minutos con Catherine, sin compromiso: ${opts.bookUrl}`
    : `¡Mil gracias por tu comentario${first ? `, ${first}` : ""}! 🙌`
}

export async function answerYouTubeComments(): Promise<YouTubeCommentResult> {
  const result: YouTubeCommentResult = { checked: 0, replied: 0, skipped: 0 }

  const off = await prisma.setting.findUnique({ where: { key: "youtube_comment_replies" } }).catch(() => null)
  if (off?.value === "off") return { ...result, error: "turned off" }

  const account = await prisma.socialAccount.findFirst({ where: { platform: "YOUTUBE", isConnected: true } })
  if (!account?.refreshToken || !account.accountId) return { ...result, error: "YouTube not connected" }
  const channelId = account.accountId

  let token: string
  try { token = await refreshAccessToken(account.refreshToken) } catch (e: any) {
    await notifyOnce(`yt-auth:${new Date().toISOString().slice(0, 10)}`, "⚠️ Reconecta YouTube", `Sofía no puede leer los comentarios de YouTube: ${e.message}. Ve a Social → Cuentas y conecta YouTube otra vez.`)
    return { ...result, error: e.message }
  }

  const list = await yt(`/commentThreads?part=snippet,replies&allThreadsRelatedToChannelId=${channelId}&order=time&maxResults=50&textFormat=plainText`, token)
  if (!list.ok) {
    const reason = list.data?.error?.errors?.[0]?.reason || list.data?.error?.message || `HTTP ${list.status}`
    return { ...result, error: `commentThreads: ${reason}` }
  }

  const cfg = await prisma.aIConfig.findFirst({ select: { calendlyUrl: true } }).catch(() => null)
  const threads: Thread[] = list.data.items || []
  const videoCache = new Map<string, { title: string; description: string }>()

  for (const t of threads) {
    if (result.replied >= MAX_PER_RUN) break
    const top = t.snippet.topLevelComment
    const s = top.snippet
    result.checked++

    const marker = `yt-cmt:${top.id}`
    const authorId = s.authorChannelId?.value
    const ownerAnswered = (t.replies?.comments || []).some(r => r.snippet.authorChannelId?.value === channelId)
    const tooOld = Date.now() - new Date(s.publishedAt).getTime() > MAX_AGE_MS
    if (authorId === channelId || ownerAnswered || tooOld) { result.skipped++; continue }
    if (await prisma.aINotification.findFirst({ where: { metadata: marker }, select: { id: true } }).catch(() => null)) { result.skipped++; continue }

    const text = (s.textOriginal || "").trim()
    const link = `https://www.youtube.com/watch?v=${t.snippet.videoId}&lc=${top.id}`
    if (!text || SPAM.test(text)) {
      await prisma.aINotification.create({ data: { type: "YOUTUBE_COMMENT", title: "YouTube: comentario ignorado (spam)", body: `${s.authorDisplayName}: "${text.slice(0, 100)}"`, priority: "LOW", metadata: marker } }).catch(() => {})
      result.skipped++
      continue
    }
    if (isAbusive(text)) {
      await prisma.aINotification.create({ data: { type: "YOUTUBE_COMMENT", title: `⚠️ Comentario ofensivo en YouTube de ${s.authorDisplayName}`, body: `"${text.slice(0, 160)}" — Sofía no respondió. Puedes ocultarlo o eliminarlo: ${link}`, priority: "HIGH", metadata: marker } }).catch(() => {})
      result.skipped++
      continue
    }

    let video = videoCache.get(t.snippet.videoId)
    if (!video) {
      const v = await yt(`/videos?part=snippet&id=${t.snippet.videoId}`, token)
      const sn = v.data?.items?.[0]?.snippet || {}
      video = { title: sn.title || "", description: sn.description || "" }
      videoCache.set(t.snippet.videoId, video)
    }

    const interested = INTEREST.test(text)
    const project = detectProject(`${video.title} ${video.description}`) || detectProject(text)
    const bookUrl = project?.href === "/parkside" ? `${SITE}/parkside/colombia/agendar` : cfg?.calendlyUrl || `${SITE}/book`
    const reply = await writeReply({ comment: text, who: s.authorDisplayName, videoTitle: video.title, videoDescription: video.description, interested, bookUrl })

    const posted = await yt(`/comments?part=snippet`, token, {
      method: "POST",
      body: JSON.stringify({ snippet: { parentId: top.id, textOriginal: reply } }),
    })
    if (!posted.ok) {
      const reason = posted.data?.error?.errors?.[0]?.reason || posted.data?.error?.message || `HTTP ${posted.status}`
      if (posted.status === 403 && /insufficient|scope|permission/i.test(String(reason))) {
        await notifyOnce("yt-scope", "⚠️ Reconecta YouTube para que Sofía responda comentarios", "Para responder comentarios, YouTube necesita un permiso nuevo. Ve a Social → Cuentas, desconecta y conecta YouTube otra vez (acepta todos los permisos).")
        return { ...result, error: `reply: ${reason}` }
      }
      console.error(`[youtube-comments] reply to ${top.id} failed: ${reason}`)
      result.skipped++
      continue
    }

    result.replied++
    await prisma.aINotification.create({
      data: {
        type: "YOUTUBE_COMMENT",
        title: interested ? `💬 ${s.authorDisplayName} preguntó en YouTube` : `💬 ${s.authorDisplayName} comentó en YouTube`,
        body: `"${text.slice(0, 140)}"${video.title ? ` — en "${video.title.slice(0, 60)}"` : ""}\nSofía: "${reply.slice(0, 200)}"\n${link}`,
        priority: interested ? "HIGH" : "LOW",
        metadata: marker,
      },
    }).catch(() => {})
  }

  console.log(`[youtube-comments] checked=${result.checked} replied=${result.replied} skipped=${result.skipped}`)
  return result
}
