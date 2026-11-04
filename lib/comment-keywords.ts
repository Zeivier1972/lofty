import Anthropic from "@anthropic-ai/sdk"
import { prisma } from "@/lib/prisma"
import { commentKeywordReply, detectProject, projectReply } from "@/lib/projects"

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

/** What the post under the comment is about, so the reply fits it. */
export async function postContextFor(externalId: string | null | undefined, fetchCaption: () => Promise<string | null>): Promise<string> {
  if (externalId) {
    const own = await prisma.socialPost.findFirst({ where: { externalId }, select: { content: true } }).catch(() => null)
    if (own?.content) return own.content
  }
  return (await fetchCaption().catch(() => null)) || ""
}

/** The "Comenta X" keyword the post itself asked for, if any. */
function postKeyword(caption: string): string | null {
  const m = caption.match(/coment[ae]\s+["“'«]?([A-ZÁÉÍÓÚÑ]{3,})/i)
  return m ? m[1].toUpperCase() : null
}

function isLocalTopic(caption: string): boolean {
  return /\bcasa(s)?\b|townhome|builder|lennar|horton|mudarte|primera casa|hipoteca|fha|south florida|homestead|kendall|doral/i.test(caption)
}

async function shortPublicReply(comment: string, caption: string, keyword: string | null, kind: "praise" | "interest-sent" | "interest-failed"): Promise<string> {
  const goal =
    kind === "praise"
      ? `agradece de forma cálida y específica a lo que dijo, conectándolo con el tema de la publicación${keyword ? `, y termina invitando suavemente a comentar ${keyword} para recibir la información` : ""}`
      : kind === "interest-sent"
        ? `responde a lo que preguntó en una frase si la publicación lo responde, y dile que ya le enviaste la información por mensaje privado`
        : `responde a lo que preguntó en una frase si la publicación lo responde, y dile que con gusto le ayuda: puede agendar una llamada de 15 minutos con Catherine en ${SITE}/book`
  try {
    const m = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 160,
      system: "Respondes comentarios en Facebook/Instagram de Catherine Gomez, Realtor en Miami (inversionistas latinoamericanos que compran preconstrucción en Miami/Orlando, y familias que compran casas nuevas en South Florida). Español latino, tuteo, cálido y breve. Máximo 25 palabras, 1 emoji como mucho. La respuesta tiene que ser sobre el tema de ESA publicación y lo que la persona dijo — nunca genérica. Si la publicación no pide una palabra clave, no inventes una. Nunca prometas rentabilidad ni des precios que no estén en la publicación. Devuelve SOLO el texto de la respuesta.",
      messages: [{ role: "user", content: `Publicación:\n"""${caption.slice(0, 1200) || "(sin texto)"}"""\n\nComentario: "${comment.slice(0, 300)}"\nObjetivo: ${goal}.` }],
    })
    const t = m.content[0]?.type === "text" ? m.content[0].text.trim().replace(/^["“]|["”]$/g, "") : ""
    if (t && t.length <= 240) return t
  } catch { /* template below */ }
  if (kind === "interest-sent") return "¡Hola! Te acabo de enviar la información por mensaje privado 📩"
  if (kind === "interest-failed") return `¡Con gusto te ayudo! Agenda 15 minutos con Catherine aquí: ${SITE}/book`
  return keyword ? `¡Gracias por comentar! 🙌 Si quieres más información, comenta ${keyword} y te la envío.` : "¡Mil gracias por comentar! 😊 Cualquier duda, aquí estoy para ayudarte."
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
  /** Caption of the post the comment is on. */
  postContext?: string
}): Promise<void> {
  const text = (opts.text || "").trim()
  if (!text || SKIP.test(text)) return

  const day = new Date().toISOString().slice(0, 10)
  const marker = `cmt-any:${opts.platform}:${opts.userKey}:${day}`
  const seen = await prisma.aINotification.findFirst({ where: { metadata: marker }, select: { id: true } }).catch(() => null)
  if (seen) return

  const caption = opts.postContext || ""
  const keyword = postKeyword(caption)
  const local = keyword === "CASA" || (!keyword && isLocalTopic(caption))

  const interested = INTEREST.test(text)
  let sent = false
  if (interested) {
    const cfg = await prisma.aIConfig.findFirst({ select: { calendlyUrl: true } }).catch(() => null)
    const book = cfg?.calendlyUrl || `${SITE}/book`
    // The private message matches the post: its project, its keyword, or its audience.
    const project = detectProject(caption) || detectProject(text)
    let msg = project
      ? projectReply(project, null, book)
      : (commentKeywordReply(keyword || (local ? "CASA" : "INVERTIR"), book)?.message || "")
    if (msg && !local) msg += `\n\n📅 Además, todos los jueves 7 PM (hora de Colombia) hay un webinar gratis en vivo: ${SITE}/webinar/serie/inversion-miami`
    if (msg) sent = await opts.sendPrivate(msg).catch(() => false)
  }
  const publicMsg = await shortPublicReply(text, caption, keyword, interested ? (sent ? "interest-sent" : "interest-failed") : "praise")
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
