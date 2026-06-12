export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  sendInstagramDM, replyToComment, verifyWebhookToken,
  extractEmail, extractPhone, isOptOut, parseIntent,
} from "@/lib/instagram"
import { ingestLead } from "@/lib/lead-ingest"

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

          // Re-trigger: reset completed/opted-out conversations so repeat commenters restart the flow
          if (existing && (existing.state === "COMPLETE" || existing.state === "OPTED_OUT")) {
            await prisma.instagramConversation.update({
              where: { igUserId },
              data: { state: "ASKED_OPTIN", sourceCommentId: commentId, intent: null, firstName: null, email: null, phone: null, contactId: null },
            })
          } else if (!existing) {
            await prisma.instagramConversation.create({
              data: { igUserId, igUsername, state: "ASKED_OPTIN", sourceCommentId: commentId },
            })
          }

          // Send greeting DM — try private reply first, fall back to direct DM
          const replied = await replyToComment(commentId, config.msgGreeting)
          if (!replied) await sendInstagramDM(igUserId, config.msgGreeting)
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

        // Re-trigger: OPTED_OUT stays blocked; COMPLETE re-starts if they send a keyword again
        if (convo.state === "OPTED_OUT") continue
        if (convo.state === "COMPLETE") {
          if (!matchesKeyword(text)) continue
          convo = await prisma.instagramConversation.update({
            where: { igUserId },
            data: { state: "ASKED_OPTIN", intent: null, firstName: null, email: null, phone: null, contactId: null },
          })
          await sendInstagramDM(igUserId, config.msgGreeting)
          continue
        }

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

          // Full lead ingestion: pipeline, smart plan, scoring, welcome SMS + email,
          // AI call, and notifications — same as Facebook/website leads
          const isPreConstruction = convo.intent === "comprador_vivienda" || convo.intent === "inversionista_airbnb"
          const { contactId } = await ingestLead({
            firstName: nameParts[0],
            lastName: nameParts.slice(1).join(" "),
            email: convo.email || undefined,
            phone,
            source: "INSTAGRAM",
            campaign: isPreConstruction ? "Instagram Bot — Preconstrucción" : "Instagram Bot",
            propertyType: isPreConstruction ? "PRE_CONSTRUCTION" : undefined,
            notes: `IG: @${convo.igUsername || igUserId}${convo.intent ? ` | Interés: ${convo.intent.replace(/_/g, " ")}` : ""}`,
            smsConsent: true, // they provided their number in the DM to be contacted
          })

          // Instagram-specific extras: handle + qualification tag
          await prisma.contact.update({
            where: { id: contactId },
            data: { socialInstagram: convo.igUsername || undefined },
          }).catch(() => {})

          if (convo.intent) {
            const tag = await prisma.tag.upsert({
              where: { name: convo.intent },
              update: {},
              create: { name: convo.intent, color: INTENT_TAG_COLORS[convo.intent] || "#3B82F6" },
            })
            await prisma.contactTag.upsert({
              where: { contactId_tagId: { contactId, tagId: tag.id } },
              update: {},
              create: { contactId, tagId: tag.id },
            })
          }

          await prisma.activity.create({
            data: {
              type: "NOTE",
              title: "Lead capturado via Instagram",
              description: `Instagram: @${convo.igUsername || igUserId}${convo.intent ? ` · Interés: ${convo.intent.replace(/_/g, " ")}` : ""}`,
              contactId,
            },
          })

          // Mark conversation complete
          await prisma.instagramConversation.update({
            where: { igUserId },
            data: { phone, state: "COMPLETE", contactId },
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
