export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  sendInstagramDM, replyToComment, verifyWebhookToken,
  extractEmail, extractPhone, isOptOut, parseIntent,
} from "@/lib/instagram"

const INTENT_TAG_COLORS: Record<string, string> = {
  comprador_vivienda: "#22C55E",
  inversionista_airbnb: "#8B5CF6",
  solo_explorando: "#94A3B8",
}

// GET — Meta webhook verification handshake
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token && verifyWebhookToken(token)) {
    console.log("[INSTAGRAM] Webhook verified")
    return new Response(challenge, { status: 200 })
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

// POST — Incoming Instagram events
export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Ignore non-instagram objects
    if (body.object !== "instagram") {
      return NextResponse.json({ ok: true })
    }

    const config = await prisma.instagramBotConfig.findFirst()
    if (!config?.isEnabled) return NextResponse.json({ ok: true })

    const keywords = config.triggerKeywords
      .split(",")
      .map((k: string) => k.trim().toLowerCase())
      .filter(Boolean)

    const matchesKeyword = (text: string) =>
      keywords.some(k => text.toLowerCase().includes(k))

    for (const entry of body.entry || []) {
      // ── Comment event ─────────────────────────────────────────────────────
      for (const change of entry.changes || []) {
        if (change.field === "comments") {
          const val = change.value
          const commentText: string = val?.text || ""
          const igUserId: string = val?.from?.id
          const igUsername: string = val?.from?.username || ""
          const commentId: string = val?.id

          if (!igUserId || !commentId) continue
          if (!matchesKeyword(commentText)) continue

          // Check if we already have an active conversation
          const existing = await prisma.instagramConversation.findUnique({
            where: { igUserId },
          })
          if (existing && existing.state === "COMPLETE") continue

          if (!existing) {
            await prisma.instagramConversation.create({
              data: { igUserId, igUsername, state: "ASKED_OPTIN", sourceCommentId: commentId },
            })
          }

          // Private reply to the comment (only allowed way to DM someone who hasn't messaged us)
          await replyToComment(commentId, config.msgGreeting)
        }
      }

      // ── DM event ──────────────────────────────────────────────────────────
      for (const msg of entry.messaging || []) {
        const igUserId: string = msg.sender?.id
        const text: string = msg.message?.text || ""
        const accountId = process.env.INSTAGRAM_ACCOUNT_ID

        // Ignore echoes (messages sent by us)
        if (!igUserId || igUserId === accountId || msg.message?.is_echo || !text) continue

        let convo = await prisma.instagramConversation.findUnique({
          where: { igUserId },
        })

        // New DM containing a trigger keyword starts a conversation (like ManyChat's DM trigger)
        if (!convo) {
          if (!matchesKeyword(text)) continue
          convo = await prisma.instagramConversation.create({
            data: { igUserId, state: "ASKED_OPTIN" },
          })
          await sendInstagramDM(igUserId, config.msgGreeting)
          continue
        }

        if (convo.state === "COMPLETE" || convo.state === "OPTED_OUT") continue

        if (isOptOut(text)) {
          await prisma.instagramConversation.update({
            where: { igUserId },
            data: { state: "OPTED_OUT" },
          })
          await sendInstagramDM(igUserId, "Entendido, no te enviaremos más mensajes. ¡Que tengas un buen día! 👋")
          continue
        }

        // ── State machine ─────────────────────────────────────────────────
        if (convo.state === "ASKED_OPTIN") {
          // Any non-opt-out reply counts as a yes → qualification question
          await prisma.instagramConversation.update({
            where: { igUserId },
            data: { state: "ASKED_INTENT" },
          })
          await sendInstagramDM(igUserId, config.msgAskIntent)

        } else if (convo.state === "ASKED_INTENT") {
          const intent = parseIntent(text)
          if (!intent) {
            await sendInstagramDM(igUserId, "Por favor responde con A, B o C 🙂")
            continue
          }
          await prisma.instagramConversation.update({
            where: { igUserId },
            data: { intent, state: "ASKED_NAME" },
          })
          await sendInstagramDM(igUserId, config.msgAskName)

        } else if (convo.state === "ASKED_NAME") {
          const name = text.trim().split(/\s+/).slice(0, 3).join(" ")
          const nextMsg = config.msgAskEmail.replace("{name}", name.split(" ")[0])
          await prisma.instagramConversation.update({
            where: { igUserId },
            data: { firstName: name, state: "ASKED_EMAIL" },
          })
          await sendInstagramDM(igUserId, nextMsg)

        } else if (convo.state === "ASKED_EMAIL") {
          const email = extractEmail(text)
          if (!email) {
            await sendInstagramDM(igUserId, "Hmm, no encontré un email válido en tu mensaje. ¿Puedes enviarlo de nuevo? Ej: tu@email.com")
            continue
          }
          const nextMsg = config.msgAskPhone.replace("{name}", convo.firstName?.split(" ")[0] || "")
          await prisma.instagramConversation.update({
            where: { igUserId },
            data: { email, state: "ASKED_PHONE" },
          })
          await sendInstagramDM(igUserId, nextMsg)

        } else if (convo.state === "ASKED_PHONE") {
          const phone = extractPhone(text)
          if (!phone) {
            await sendInstagramDM(igUserId, "No encontré un número válido. ¿Puedes enviarlo de nuevo? Ej: +1 786 123 4567")
            continue
          }

          const nameParts = (convo.firstName || convo.igUsername || "Instagram Lead").split(/\s+/)
          // Create contact in CRM
          const contact = await prisma.contact.create({
            data: {
              firstName: nameParts[0],
              lastName: nameParts.slice(1).join(" "),
              email: convo.email || undefined,
              phone,
              source: "INSTAGRAM",
              status: "LEAD",
              socialInstagram: convo.igUsername || undefined,
            },
          })

          // Tag by qualification intent (comprador_vivienda / inversionista_airbnb / solo_explorando)
          if (convo.intent) {
            const tag = await prisma.tag.upsert({
              where: { name: convo.intent },
              update: {},
              create: { name: convo.intent, color: INTENT_TAG_COLORS[convo.intent] || "#3B82F6" },
            })
            await prisma.contactTag.create({
              data: { contactId: contact.id, tagId: tag.id },
            })
          }

          // Add to default pipeline
          const pipeline = await prisma.pipeline.findFirst({
            where: { isDefault: true },
            include: { stages: { orderBy: { order: "asc" }, take: 1 } },
          })
          if (pipeline?.stages[0]) {
            await prisma.pipelineLead.create({
              data: { contactId: contact.id, stageId: pipeline.stages[0].id },
            })
          }

          // Create activity
          await prisma.activity.create({
            data: {
              type: "NOTE",
              title: "Lead capturado via Instagram",
              description: `Instagram: @${convo.igUsername || igUserId}${convo.intent ? ` · Interés: ${convo.intent.replace(/_/g, " ")}` : ""}`,
              contactId: contact.id,
            },
          })

          // Notify agent
          await prisma.aINotification.create({
            data: {
              type: "NEW_LEAD",
              title: `📸 Nuevo lead de Instagram: ${convo.firstName || convo.igUsername}`,
              body: `Email: ${convo.email || "N/A"} · Teléfono: ${phone}${convo.intent ? ` · Interés: ${convo.intent.replace(/_/g, " ")}` : ""} · IG: @${convo.igUsername || igUserId}`,
              priority: "HIGH",
              contactId: contact.id,
            },
          })

          // Mark conversation complete
          await prisma.instagramConversation.update({
            where: { igUserId },
            data: { phone, state: "COMPLETE", contactId: contact.id },
          })

          // Send thank you with website link
          const thankYou = config.msgThankYou
            .replace("{name}", convo.firstName?.split(" ")[0] || "")
            .replace("{website}", config.websiteUrl || "")
          await sendInstagramDM(igUserId, thankYou)
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[INSTAGRAM] Webhook error:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
