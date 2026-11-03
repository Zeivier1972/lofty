import Anthropic from "@anthropic-ai/sdk"
import { prisma } from "@/lib/prisma"
import { commentKeywordReply } from "@/lib/projects"

/**
 * A comment with one of the Auto-Pilot keywords (DOMUS, PARKSIDE, CASA,
 * INVERTIR…) gets the matching link by private message — once per person and
 * keyword per day — and Catherine a bell. Returns true when handled.
 */
export async function handleCommentKeyword(opts: {
  platform: "Instagram" | "Facebook"
  userKey: string
  who: string
  text: string
  sendPrivate: (msg: string) => Promise<boolean>
  replyPublic: (msg: string) => Promise<unknown>
}): Promise<boolean> {
  const cfg = await prisma.aIConfig.findFirst({ select: { calendlyUrl: true } }).catch(() => null)
  const bookUrl = cfg?.calendlyUrl || `${process.env.NEXT_PUBLIC_APP_URL || "https://www.catherinegomezrealtor.com"}/book`
  const reply = commentKeywordReply(opts.text, bookUrl)
  if (!reply) return false
  const marker = `cmt:${opts.platform}:${opts.userKey}:${reply.label}`
  const recent = await prisma.aINotification.findFirst({
    where: { metadata: marker, createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
    select: { id: true },
  }).catch(() => null)
  if (recent) return true
  const sent = await opts.sendPrivate(reply.message).catch(() => false)
  if (sent) opts.replyPublic("¡Listo! Te envié la información por mensaje privado 📩").catch(() => {})
  await prisma.aINotification.create({
    data: {
      type: opts.platform === "Instagram" ? "INSTAGRAM_REPLY" : "FACEBOOK_REPLY",
      title: `💬 ${opts.who} comentó por ${reply.label} (${opts.platform})`,
      body: sent ? `Comentó "${opts.text.slice(0, 80)}" y le enviamos el link por mensaje privado.` : `Comentó "${opts.text.slice(0, 80)}" pero el mensaje privado no salió — respóndele desde ${opts.platform}.`,
      priority: "HIGH",
      metadata: marker,
    },
  }).catch(() => {})
  return true
}

// ─── Every other comment ─────────────────────────────────────────────────────


const anthropic = new Anthropic()
const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://www.catherinegomezrealtor.com"

/** Asks for info/price/availability, or any question — worth a private message. */
const INTEREST = /precio|cu[aá]nto|cost|info|interes|detalle|disponib|cotiz|quiero|me gustar[ií]a|c[oó]mo (se )?(compr|invier|hag|pued)|requisit|financ|cr[eé]dito|enganche|cuota|link|enlace|whats|llam|\?/i
/** Links, spam and abuse get no answer. */
const SKIP = /https?:\/\/|www\.|\bscam\b|estafa|fraude|bitcoin|crypto|forex|gana dinero|dm me|follow me|s[ií]gueme/i

const PRAISE_FALLBACK = [
  "¡Gracias por comentar! 🙌 Si quieres los números completos, comenta INVERTIR y te los envío.",
  "¡Mil gracias! 😊 Cualquier duda sobre comprar en Miami, aquí estoy para ayudarte.",
  "¡Qué bueno que te guste! 🏙️ Si estás pensando en invertir, comenta INVERTIR y te envío la info.",
  "¡Gracias! 🙏 Todos los jueves explico esto en vivo — comenta INVERTIR y te mando el enlace.",
]

async function shortPublicReply(comment: string, kind: "praise" | "interest-sent" | "interest-failed"): Promise<string> {
  const goal =
    kind === "praise"
      ? `agradece de forma cálida y específica a lo que dijo, y termina invitando suavemente a comentar INVERTIR para recibir la información`
      : kind === "interest-sent"
        ? `dile que ya le enviaste la información por mensaje privado`
        : `dile que con gusto le ayuda y que agende una llamada de 15 minutos con Catherine en ${SITE}/book`
  try {
    const m = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 120,
      system: "Respondes comentarios en Facebook/Instagram de Catherine Gomez, Realtor en Miami. Español latino, tuteo, cálido y breve. Máximo 22 palabras, 1 emoji como mucho. Nunca prometas rentabilidad ni des precios. Devuelve SOLO el texto de la respuesta.",
      messages: [{ role: "user", content: `Comentario: "${comment.slice(0, 300)}"\nObjetivo: ${goal}.` }],
    })
    const t = m.content[0]?.type === "text" ? m.content[0].text.trim().replace(/^["“]|["”]$/g, "") : ""
    if (t && t.length <= 220) return t
  } catch { /* template below */ }
  if (kind === "interest-sent") return "¡Hola! Te acabo de enviar la información por mensaje privado 📩"
  if (kind === "interest-failed") return `¡Con gusto te ayudo! Agenda 15 minutos con Catherine aquí: ${SITE}/book`
  return PRAISE_FALLBACK[Math.floor(Math.random() * PRAISE_FALLBACK.length)]
}

/**
 * Comments without a keyword: Sofía still answers. A question or "info/precio"
 * gets the investor message by DM plus a public "te escribí"; praise gets a
 * short, varied public thank-you that invites the keyword. Once per person
 * per day, so a long thread is not flooded.
 */
export async function handleOtherComment(opts: {
  platform: "Instagram" | "Facebook"
  userKey: string
  who: string
  text: string
  sendPrivate: (msg: string) => Promise<boolean>
  replyPublic: (msg: string) => Promise<unknown>
}): Promise<void> {
  const text = (opts.text || "").trim()
  if (!text || SKIP.test(text)) return

  const day = new Date().toISOString().slice(0, 10)
  const marker = `cmt-any:${opts.platform}:${opts.userKey}:${day}`
  const seen = await prisma.aINotification.findFirst({ where: { metadata: marker }, select: { id: true } }).catch(() => null)
  if (seen) return

  const interested = INTEREST.test(text)
  let sent = false
  if (interested) {
    const cfg = await prisma.aIConfig.findFirst({ select: { calendlyUrl: true } }).catch(() => null)
    const reply = commentKeywordReply("INVERTIR", cfg?.calendlyUrl || `${SITE}/book`)
    if (reply) {
      const msg = `${reply.message}\n\n📅 Además, todos los jueves 7 PM (hora de Colombia) hay un webinar gratis en vivo: ${SITE}/webinar/serie/inversion-miami`
      sent = await opts.sendPrivate(msg).catch(() => false)
    }
  }
  const publicMsg = await shortPublicReply(text, interested ? (sent ? "interest-sent" : "interest-failed") : "praise")
  await Promise.resolve(opts.replyPublic(publicMsg)).catch(() => {})

  await prisma.aINotification.create({
    data: {
      type: opts.platform === "Instagram" ? "INSTAGRAM_REPLY" : "FACEBOOK_REPLY",
      title: interested ? `💬 ${opts.who} preguntó en un comentario (${opts.platform})` : `💬 ${opts.who} comentó (${opts.platform})`,
      body: `"${text.slice(0, 100)}" → ${interested ? (sent ? "le enviamos la info por mensaje privado" : "el mensaje privado no salió; respondimos con el enlace para agendar") : "respondimos con un agradecimiento"}`,
      priority: interested ? "HIGH" : "LOW",
      metadata: marker,
    },
  }).catch(() => {})
}
