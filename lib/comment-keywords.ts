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
